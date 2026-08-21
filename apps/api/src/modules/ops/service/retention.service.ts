import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../../core/storage/storage.service';
import { RetentionRepository, type RetentionPolicyRow } from '../repository/retention.repository';
import { AuditService } from './audit.service';

/**
 * 보존기간 자동 파기 (CLAUDE.md §7 · docs/11 §4).
 *
 * **수동 파기 정책은 지켜지지 않습니다.** 지켜야 할 사람이 매일 기억해야 하고,
 * 안 지켜도 아무 일도 일어나지 않기 때문입니다. 그래서 잡으로 돌립니다.
 *
 * ── 데이터 유형 ↔ 처리 ──────────────────────────────────────────────────
 * `data_retention_policies` 테이블이 기준입니다. 코드에 기간을 박지 않습니다 —
 * 보존기간은 법 개정과 노무 검토로 바뀝니다.
 *
 * 유형별 처리 대상은 코드가 압니다. 어느 테이블의 무엇을 지울지는 데이터로
 * 표현할 수 없기 때문입니다. 정책 행에 대응하는 처리가 없으면 **건너뛰고
 * 로그를 남깁니다** — 조용히 통과시키면 새 정책을 넣고도 아무 일이 일어나지
 * 않는 것을 아무도 모릅니다.
 */
export interface PurgeOutcome {
  dataType: string;
  strategy: string;
  purged: number;
  /** 오브젝트 저장소에서 삭제를 확인하지 못한 건수. */
  unconfirmed: number;
  /** 처리하지 않은 이유. 처리했으면 null. */
  skippedReason: string | null;
}

/** 유형 → 대상 서류 종류. 정책 테이블이 아니라 여기 있는 이유는 위 주석 참조. */
const DOCUMENT_TYPES_BY_POLICY: Record<string, string[]> = {
  DOCUMENT_CRIMINAL: ['CRIMINAL_RECORD'],
  DOCUMENT_HEALTH: ['HEALTH'],
  DOCUMENT_IDENTITY: ['IDENTITY'],
};

@Injectable()
export class RetentionService {
  private readonly log = new Logger(RetentionService.name);

  constructor(
    private readonly repo: RetentionRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async purgeAll(batchSize = 200): Promise<PurgeOutcome[]> {
    const policies = await this.repo.activePolicies();
    const out: PurgeOutcome[] = [];
    for (const policy of policies) {
      out.push(await this.applyPolicy(policy, batchSize));
    }
    return out;
  }

  private async applyPolicy(policy: RetentionPolicyRow, batchSize: number): Promise<PurgeOutcome> {
    const base = {
      dataType: policy.data_type, strategy: policy.purge_strategy,
      purged: 0, unconfirmed: 0,
    };

    // NULL은 영구 보존입니다. 0일과 다릅니다 — 0일은 '즉시 파기'입니다.
    if (policy.retention_days === null) {
      return { ...base, skippedReason: 'retention is indefinite' };
    }

    switch (policy.purge_strategy) {
      case 'ARCHIVE':
        // **삭제가 아닙니다.** 보관처로 옮기는 처리이고, 보관처가 아직
        // 없습니다. 여기서 지우면 '아카이브'라는 이름으로 근무 기록과
        // 감사 로그가 사라집니다 — 정확히 반대 방향의 사고입니다.
        return { ...base, skippedReason: 'archive destination is not configured; nothing is deleted' };

      case 'HARD_DELETE':
        return this.purgeDocuments(policy, batchSize);

      case 'ANONYMIZE':
        return this.anonymize(policy, batchSize);

      default:
        this.log.warn(
          `data-retention-purge: '${policy.data_type}'의 처리 방식 ` +
          `'${policy.purge_strategy}'에 대응하는 구현이 없습니다 — 건너뜁니다`,
        );
        return { ...base, skippedReason: `no handler for strategy '${policy.purge_strategy}'` };
    }
  }

  /**
   * 서류 **원본**만 파기합니다.
   *
   * 행을 지우지 않습니다 (§6-18). `verdict`가 남아야 "확인했고 결과가
   * 이랬다"를 증명할 수 있습니다. 원본을 지운 사실 자체도 `original_purged_at`에
   * 남습니다 — 파기 대장입니다.
   */
  private async purgeDocuments(policy: RetentionPolicyRow, batchSize: number): Promise<PurgeOutcome> {
    const base = {
      dataType: policy.data_type, strategy: policy.purge_strategy, purged: 0, unconfirmed: 0,
    };
    const docTypes = DOCUMENT_TYPES_BY_POLICY[policy.data_type];
    if (!docTypes) {
      return { ...base, skippedReason: `no document types mapped for '${policy.data_type}'` };
    }

    const days = policy.retention_days!;
    const rows = policy.data_type === 'DOCUMENT_IDENTITY'
      // 신분 서류는 계약 종료가 기산점입니다.
      ? await this.repo.purgeableIdentityDocuments(docTypes, days, batchSize)
      // 범죄경력·건강진단서는 확인이 끝나면 곧바로 대상입니다.
      : await this.repo.purgeableVerdictDocuments(docTypes, days, batchSize);

    let purged = 0;
    let unconfirmed = 0;
    for (const row of rows) {
      const result = await this.storage.deleteObject(row.file_key);
      if (result !== 'DELETED') unconfirmed++;
      await this.repo.markDocumentPurged(row.id);
      await this.audit.record({
        actorUserId: null, action: 'DELETE',
        targetType: 'document', targetId: row.id,
        after: {
          reason: 'data-retention-purge',
          dataType: policy.data_type, retentionDays: days,
          legalBasis: policy.legal_basis,
          // 무엇을 남겼는지 함께 적습니다 — 파기 후 남은 것이 무엇인지가
          // 나중에 가장 자주 묻는 질문입니다.
          retainedVerdict: row.verdict,
          objectDeletion: result,
        },
      });
      purged++;
    }

    if (unconfirmed > 0) {
      this.log.warn(
        `data-retention-purge: ${policy.data_type} — 오브젝트 저장소 삭제를 ` +
        `확인하지 못한 건 ${unconfirmed}건. DB 참조는 지웠지만 파일이 남아 있을 수 있습니다`,
      );
    }
    return { ...base, purged, unconfirmed, skippedReason: null };
  }

  /**
   * 탈퇴 사용자 익명화.
   *
   * 행을 지우지 않습니다. 근무 기록·감사 로그가 이 id를 참조하고 그것들은
   * 파기 대상이 아닙니다. 식별자만 무효화합니다.
   */
  private async anonymize(policy: RetentionPolicyRow, batchSize: number): Promise<PurgeOutcome> {
    const base = {
      dataType: policy.data_type, strategy: policy.purge_strategy, purged: 0, unconfirmed: 0,
    };
    if (policy.data_type !== 'WITHDRAWN_USER') {
      return { ...base, skippedReason: `no handler for '${policy.data_type}'` };
    }

    const rows = await this.repo.anonymizableUsers(policy.retention_days!, batchSize);
    for (const row of rows) {
      await this.repo.anonymizeUser(row.id);
      await this.audit.record({
        actorUserId: null, action: 'DELETE',
        targetType: 'user', targetId: row.id,
        after: {
          reason: 'data-retention-purge',
          dataType: policy.data_type, retentionDays: policy.retention_days,
          legalBasis: policy.legal_basis,
          withdrawalRequestedAt: row.withdrawal_requested_at,
        },
      });
    }
    return { ...base, purged: rows.length, skippedReason: null };
  }
}
