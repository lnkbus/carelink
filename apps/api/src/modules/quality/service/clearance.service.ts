import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { ClearanceRepository, type ClearanceRow } from '../repository/clearance.repository';
import {
  clearanceMachine, isCleared, REQUIRED_CLEARANCES,
  type ClearanceResult, type ClearanceType,
} from '../state/clearance.state';

export interface DeploymentReadiness {
  ready: boolean;
  /** 통과하지 못한 항목. 차단 사유를 화면에 함께 보여주기 위해 항상 채운다. */
  missing: ClearanceType[];
  /** 만료된 항목. 미제출과 구분해야 운영자가 무엇을 해야 할지 안다. */
  expired: ClearanceType[];
}

/**
 * quality — 배치 전 클리어런스 게이트 (docs/02 §4 · docs/07 §4).
 *
 * 6개 항목이 전부 PASS여야 배치 가능하다. 운영자가 예외 처리할 수 없도록
 * 서비스 레벨에서 막는다 — 예외 경로를 만들면 그 경로가 기본값이 된다 (§5.11).
 */
@Injectable()
export class ClearanceService {
  constructor(
    private readonly repo: ClearanceRepository,
    private readonly audit: AuditService,
  ) {}

  list(workerUserId: string): Promise<ClearanceRow[]> {
    return this.repo.listByWorker(workerUserId);
  }

  async isReadyForDeployment(workerUserId: string): Promise<DeploymentReadiness> {
    return this.evaluate(await this.repo.listByWorker(workerUserId));
  }

  /** 여러 인력을 한 번에. 매칭이 후보자 수만큼 쿼리를 돌리지 않도록. */
  async readinessByWorker(workerUserIds: string[]): Promise<Map<string, DeploymentReadiness>> {
    const rows = await this.repo.listByWorkers(workerUserIds);
    const grouped = new Map<string, ClearanceRow[]>();
    for (const id of workerUserIds) grouped.set(id, []);
    for (const row of rows) grouped.get(row.worker_user_id)?.push(row);

    const out = new Map<string, DeploymentReadiness>();
    for (const [userId, list] of grouped) out.set(userId, this.evaluate(list));
    return out;
  }

  private evaluate(rows: ClearanceRow[]): DeploymentReadiness {
    const byType = new Map(rows.map((r) => [r.clearance_type, r]));
    const missing: ClearanceType[] = [];
    const expired: ClearanceType[] = [];

    for (const type of REQUIRED_CLEARANCES) {
      const row = byType.get(type);
      // 기록이 아예 없으면 미완이다. 없는 것을 통과로 보면 게이트가 무의미해진다.
      if (!row) { missing.push(type); continue; }
      if (row.result === 'EXPIRED') { expired.push(type); continue; }
      if (!isCleared(row.result)) missing.push(type);
    }
    return { ready: missing.length === 0 && expired.length === 0, missing, expired };
  }

  /** 배치 시도 시 호출한다. 통과하지 못하면 사유를 담아 던진다. */
  async assertReadyForDeployment(workerUserId: string): Promise<void> {
    const readiness = await this.isReadyForDeployment(workerUserId);
    if (readiness.ready) return;
    throw new DomainError(
      readiness.expired.length > 0 ? 'QUALITY_CLEARANCE_EXPIRED' : 'QUALITY_CLEARANCE_INCOMPLETE',
      { missing: readiness.missing, expired: readiness.expired, required: REQUIRED_CLEARANCES },
    );
  }

  /**
   * 검사 결과 기록. 판정은 사람이 하고 시스템은 기록만 한다 (§6-1).
   * 유효기간은 호출자가 넘긴다 — 범죄경력 2년, 건강진단 1년 (docs/07 §3.1).
   */
  async record(input: {
    workerUserId: string; clearanceType: ClearanceType; result: ClearanceResult;
    documentId: string | null; expiresOn: string | null; note: string | null; actorUserId: string;
  }): Promise<ClearanceRow> {
    const existing = (await this.repo.listByWorker(input.workerUserId))
      .find((r) => r.clearance_type === input.clearanceType);
    if (existing) clearanceMachine.assert(existing.result, input.result);

    const row = await this.repo.upsert({
      workerUserId: input.workerUserId, clearanceType: input.clearanceType, result: input.result,
      documentId: input.documentId, checkedBy: input.actorUserId,
      expiresOn: input.expiresOn, note: input.note,
    });
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE', targetType: 'worker_clearance',
      targetId: row.id, before: { result: existing?.result ?? null },
      after: { clearanceType: input.clearanceType, result: input.result, expiresOn: input.expiresOn },
    });
    return row;
  }

  expiringWithin(days: number) { return this.repo.expiringWithin(days); }
  dueForExpiry() { return this.repo.dueForExpiry(); }
  setResult(id: string, result: ClearanceResult) { return this.repo.setResult(id, result); }
}
