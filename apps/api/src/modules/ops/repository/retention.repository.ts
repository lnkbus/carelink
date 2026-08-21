import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

export interface RetentionPolicyRow {
  id: string;
  data_type: string;
  retention_days: number | null;
  purge_strategy: string;
  legal_basis: string | null;
}

export interface PurgeableDocumentRow {
  id: string;
  candidate_id: string;
  doc_type: string;
  file_key: string;
  verdict: string | null;
}

export interface AnonymizableUserRow {
  id: string;
  withdrawal_requested_at: Date | null;
}

@Injectable()
export class RetentionRepository {
  constructor(private readonly db: DbService) {}

  activePolicies(): Promise<RetentionPolicyRow[]> {
    return this.db.query<RetentionPolicyRow>(
      `SELECT id, data_type, retention_days, purge_strategy, legal_basis
         FROM data_retention_policies
        WHERE is_active = true
        ORDER BY data_type`,
    );
  }

  /**
   * 확인이 끝나 원본을 파기해야 하는 범죄경력·건강진단서.
   *
   * **`verdict`가 있어야 대상입니다** (§6-18). 검토 전에 파기하면 확인할
   * 근거가 사라집니다 — 파기는 확인 **후**의 행위입니다.
   *
   * 보존기간이 0일이라도 검토 당일에 지우지 않고 `reviewed_at + N일`로
   * 계산합니다. 0이면 검토가 끝난 건이 곧바로 대상이 됩니다.
   */
  purgeableVerdictDocuments(docTypes: string[], retentionDays: number, limit: number)
    : Promise<PurgeableDocumentRow[]> {
    return this.db.query<PurgeableDocumentRow>(
      `SELECT id, candidate_id, doc_type::text AS doc_type, file_key, verdict
         FROM documents
        WHERE doc_type::text = ANY($1::text[])
          AND file_key IS NOT NULL
          AND original_purged_at IS NULL
          AND verdict IS NOT NULL
          AND reviewed_at IS NOT NULL
          AND reviewed_at <= now() - make_interval(days => $2::int)
        ORDER BY reviewed_at
        LIMIT $3`,
      [docTypes, retentionDays, limit],
    );
  }

  /**
   * 계약 종료 후 보존기간이 지난 신분 서류.
   *
   * 기준은 검토일이 아니라 **계약 종료일**입니다 ('계약 종료 후 1년').
   * 배치가 하나라도 살아 있으면 대상이 아닙니다 — 근무 중인 사람의 신분
   * 서류를 지우면 그날로 신원 확인이 불가능해집니다.
   *
   * 배치 이력이 아예 없는 후보자는 대상에서 제외합니다. 종료일이 없으면
   * 기산점이 없고, 기산점을 검토일로 대체하는 것은 근거 없는 추정입니다.
   */
  purgeableIdentityDocuments(docTypes: string[], retentionDays: number, limit: number)
    : Promise<PurgeableDocumentRow[]> {
    return this.db.query<PurgeableDocumentRow>(
      `SELECT d.id, d.candidate_id, d.doc_type::text AS doc_type, d.file_key, d.verdict
         FROM documents d
         JOIN candidates c ON c.id = d.candidate_id
        WHERE d.doc_type::text = ANY($1::text[])
          AND d.file_key IS NOT NULL
          AND d.original_purged_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM engagements e
             WHERE e.worker_user_id = c.user_id
               AND e.status <> 'ENDED'
          )
          AND (
            SELECT max(e.ended_on) FROM engagements e WHERE e.worker_user_id = c.user_id
          ) <= (now() - make_interval(days => $2::int))::date
        ORDER BY d.created_at
        LIMIT $3`,
      [docTypes, retentionDays, limit],
    );
  }

  /** 파기 기록. 행은 남고 파일 참조만 사라집니다 — 결과값(verdict)이 근거로 남습니다. */
  async markDocumentPurged(id: string): Promise<void> {
    await this.db.query(
      `UPDATE documents SET file_key = NULL, original_purged_at = now() WHERE id = $1`,
      [id],
    );
  }

  /**
   * 탈퇴 후 보존기간이 지난 사용자.
   *
   * **분쟁이 걸려 있으면 제외합니다** (시드의 '분쟁 진행 시 예외'). 열린
   * 사건이 있거나 종료되지 않은 배치가 있으면 익명화하지 않습니다 —
   * 익명화한 뒤에는 상대방도 우리도 사실관계를 확인할 수 없습니다.
   */
  anonymizableUsers(retentionDays: number, limit: number): Promise<AnonymizableUserRow[]> {
    return this.db.query<AnonymizableUserRow>(
      `SELECT u.id, u.withdrawal_requested_at
         FROM users u
        WHERE u.status = 'WITHDRAWAL_REQUESTED'
          AND u.anonymized_at IS NULL
          AND u.withdrawal_requested_at IS NOT NULL
          AND u.withdrawal_requested_at <= now() - make_interval(days => $1::int)
          AND NOT EXISTS (
            SELECT 1 FROM support_tickets t
             WHERE t.reporter_id = u.id AND t.status <> 'RESOLVED'
          )
          AND NOT EXISTS (
            SELECT 1 FROM engagements e
             WHERE e.worker_user_id = u.id AND e.status <> 'ENDED'
          )
        ORDER BY u.withdrawal_requested_at
        LIMIT $2`,
      [retentionDays, limit],
    );
  }

  /**
   * 익명화.
   *
   * 행을 지우지 않습니다 — `work_records`·`service_logs`·`audit_logs`가 이 id를
   * 참조하고, 그 기록들은 파기 대상이 아닙니다. 식별자만 무효화합니다.
   *
   * 이메일은 NULL로 두지 않고 도메인이 없는 값으로 채웁니다. NULL로 두면
   * "가입 시 이메일을 안 적은 사용자"와 구분되지 않습니다.
   */
  async anonymizeUser(id: string): Promise<void> {
    await this.db.query(
      `UPDATE users
          SET email = 'withdrawn+' || id::text || '@invalid',
              phone = NULL,
              password_hash = NULL,
              anonymized_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [id],
    );
  }
}
