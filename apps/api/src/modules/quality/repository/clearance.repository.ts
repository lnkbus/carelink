import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { ClearanceResult, ClearanceType } from '../state/clearance.state';

export interface ClearanceRow {
  id: string; worker_user_id: string; clearance_type: ClearanceType;
  result: ClearanceResult; document_id: string | null;
  checked_by: string | null; checked_at: Date | null;
  expires_on: Date | null; note: string | null;
}

export interface ConsoleClearanceRow extends ClearanceRow {
  display_code: string | null;
  candidate_status: string | null;
}

export interface RestrictedFlagRow {
  id: string; restricted_flags: string[]; status: string; created_at: Date; ward: string | null;
}

@Injectable()
export class ClearanceRepository {
  constructor(private readonly db: DbService) {}

  listByWorker(workerUserId: string): Promise<ClearanceRow[]> {
    return this.db.query<ClearanceRow>(
      `SELECT id, worker_user_id, clearance_type, result, document_id,
              checked_by, checked_at, expires_on, note
         FROM worker_clearances WHERE worker_user_id = $1 ORDER BY clearance_type`,
      [workerUserId],
    );
  }

  /** 여러 인력의 클리어런스를 한 번에. 매칭에서 후보자 수만큼 쿼리를 돌리지 않기 위함. */
  listByWorkers(workerUserIds: string[]): Promise<ClearanceRow[]> {
    if (workerUserIds.length === 0) return Promise.resolve([]);
    return this.db.query<ClearanceRow>(
      `SELECT id, worker_user_id, clearance_type, result, document_id,
              checked_by, checked_at, expires_on, note
         FROM worker_clearances WHERE worker_user_id = ANY($1::uuid[])`,
      [workerUserIds],
    );
  }

  findById(id: string): Promise<ClearanceRow | null> {
    return this.db.one<ClearanceRow>(
      `SELECT id, worker_user_id, clearance_type, result, document_id,
              checked_by, checked_at, expires_on, note
         FROM worker_clearances WHERE id = $1`,
      [id],
    );
  }

  /**
   * SCR-509 운영 목록. 결과·만료임박으로 거른다.
   *
   * 인력 식별자는 display_code까지만 내보낸다 — 이 화면은 검증 상태를 보는 곳이지
   * 인적사항을 보는 곳이 아니다. 국적은 조회 조건에도, 결과에도 들어가지 않는다
   * (§5.10 · SCR-509 notes).
   */
  listForConsole(filter: { result?: string; expiringDays?: number }): Promise<ConsoleClearanceRow[]> {
    return this.db.query<ConsoleClearanceRow>(
      `SELECT wc.id, wc.worker_user_id, wc.clearance_type, wc.result, wc.document_id,
              wc.checked_by, wc.checked_at, wc.expires_on, wc.note,
              c.display_code, c.status::text AS candidate_status
         FROM worker_clearances wc
         LEFT JOIN candidates c ON c.user_id = wc.worker_user_id
        WHERE ($1::text IS NULL OR wc.result::text = $1)
          AND ($2::int IS NULL OR (wc.expires_on IS NOT NULL
               AND wc.expires_on <= CURRENT_DATE + ($2::text || ' days')::interval))
        ORDER BY (c.status IN ('PLACED','MATCHED')) DESC NULLS LAST,
                 wc.expires_on NULLS LAST, wc.clearance_type`,
      [filter.result ?? null, filter.expiringDays ?? null],
    );
  }

  /**
   * 업무범위 키워드가 걸린 요청. care 모듈(V2)이 채우는 데이터라 V1에서는 비어 있다.
   * 화면과 경로를 먼저 열어 두는 이유는, care가 붙는 시점에 감지 결과를 볼 곳이
   * 없으면 OPS_REVIEW로 보낸 건이 그대로 방치되기 때문이다.
   */
  listRestrictedFlags(): Promise<RestrictedFlagRow[]> {
    return this.db.query<RestrictedFlagRow>(
      `SELECT id, restricted_flags, status::text AS status, created_at, ward
         FROM care_requests
        WHERE restricted_flags IS NOT NULL AND array_length(restricted_flags, 1) > 0
        ORDER BY created_at DESC LIMIT 200`,
    );
  }

  async upsert(input: {
    workerUserId: string; clearanceType: ClearanceType; result: ClearanceResult;
    documentId: string | null; checkedBy: string; expiresOn: string | null; note: string | null;
  }): Promise<ClearanceRow> {
    const row = await this.db.one<ClearanceRow>(
      `INSERT INTO worker_clearances
         (worker_user_id, clearance_type, result, document_id, checked_by, checked_at, expires_on, note)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
       ON CONFLICT (worker_user_id, clearance_type) DO UPDATE
         SET result = EXCLUDED.result, document_id = EXCLUDED.document_id,
             checked_by = EXCLUDED.checked_by, checked_at = now(),
             expires_on = EXCLUDED.expires_on, note = EXCLUDED.note
       RETURNING id, worker_user_id, clearance_type, result, document_id,
                 checked_by, checked_at, expires_on, note`,
      [input.workerUserId, input.clearanceType, input.result, input.documentId,
       input.checkedBy, input.expiresOn, input.note],
    );
    return row!;
  }

  /** 만료일이 지난 PASS 항목. clearance-expire 잡이 쓴다. */
  dueForExpiry(): Promise<ClearanceRow[]> {
    return this.db.query<ClearanceRow>(
      `SELECT id, worker_user_id, clearance_type, result, document_id,
              checked_by, checked_at, expires_on, note
         FROM worker_clearances
        WHERE result = 'PASS' AND expires_on IS NOT NULL AND expires_on <= CURRENT_DATE`,
    );
  }

  expiringWithin(days: number): Promise<(ClearanceRow & { candidate_status: string | null })[]> {
    return this.db.query(
      `SELECT wc.id, wc.worker_user_id, wc.clearance_type, wc.result, wc.document_id,
              wc.checked_by, wc.checked_at, wc.expires_on, wc.note,
              c.status::text AS candidate_status
         FROM worker_clearances wc
         LEFT JOIN candidates c ON c.user_id = wc.worker_user_id
        WHERE wc.result = 'PASS'
          AND wc.expires_on IS NOT NULL
          AND wc.expires_on > CURRENT_DATE
          AND wc.expires_on <= CURRENT_DATE + ($1 || ' days')::interval
        ORDER BY (c.status IN ('PLACED','MATCHED')) DESC NULLS LAST, wc.expires_on`,
      [days],
    ) as Promise<(ClearanceRow & { candidate_status: string | null })[]>;
  }

  async setResult(id: string, result: ClearanceResult): Promise<void> {
    await this.db.query(`UPDATE worker_clearances SET result = $2 WHERE id = $1`, [id, result]);
  }
}
