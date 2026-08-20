import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { ClearanceResult, ClearanceType } from '../state/clearance.state';

export interface ClearanceRow {
  id: string; worker_user_id: string; clearance_type: ClearanceType;
  result: ClearanceResult; document_id: string | null;
  checked_by: string | null; checked_at: Date | null;
  expires_on: Date | null; note: string | null;
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
