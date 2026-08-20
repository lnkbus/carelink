import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { EngagementModel } from '../strategy/engagement.strategy';
import type { EngagementStatus } from '../state/engagement.state';

export interface EngagementRow {
  id: string; worker_user_id: string; candidate_id: string | null;
  organization_id: string; track_id: string; job_id: string | null;
  model: EngagementModel; status: EngagementStatus;
  started_on: Date | null; ended_on: Date | null; end_reason: string | null;
  previous_engagement_id: string | null; created_at: Date;
  organization_name?: string; track_code?: string; display_code?: string | null;
}

export interface ComplianceCheckRow {
  id: string; engagement_id: string; check_code: string;
  result: string; checked_by: string | null; checked_at: Date | null; note: string | null;
}

const COLS = `e.id, e.worker_user_id, e.candidate_id, e.organization_id, e.track_id, e.job_id,
              e.model, e.status, e.started_on, e.ended_on, e.end_reason,
              e.previous_engagement_id, e.created_at,
              o.name AS organization_name, t.code AS track_code, c.display_code`;
const FROM = `FROM engagements e
                JOIN organizations o ON o.id = e.organization_id
                JOIN tracks t ON t.id = e.track_id
                LEFT JOIN candidates c ON c.id = e.candidate_id`;

@Injectable()
export class EngagementRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<EngagementRow | null> {
    return this.db.one<EngagementRow>(`SELECT ${COLS} ${FROM} WHERE e.id = $1`, [id]);
  }

  list(filter: { organizationId?: string; status?: EngagementStatus; workerUserId?: string }): Promise<EngagementRow[]> {
    return this.db.query<EngagementRow>(
      `SELECT ${COLS} ${FROM}
        WHERE ($1::uuid IS NULL OR e.organization_id = $1)
          AND ($2::engagement_status IS NULL OR e.status = $2)
          AND ($3::uuid IS NULL OR e.worker_user_id = $3)
        ORDER BY e.created_at DESC`,
      [filter.organizationId ?? null, filter.status ?? null, filter.workerUserId ?? null],
    );
  }

  async create(input: {
    workerUserId: string; candidateId: string | null; organizationId: string; trackId: string;
    jobId: string | null; model: EngagementModel; startedOn: string | null;
    previousEngagementId: string | null;
  }): Promise<EngagementRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO engagements (worker_user_id, candidate_id, organization_id, track_id, job_id,
                                model, started_on, previous_engagement_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.workerUserId, input.candidateId, input.organizationId, input.trackId,
       input.jobId, input.model, input.startedOn, input.previousEngagementId],
    );
    return (await this.findById(row!.id))!;
  }

  async setStatus(id: string, status: EngagementStatus, endReason: string | null): Promise<void> {
    await this.db.query(
      `UPDATE engagements
          SET status = $2::engagement_status,
              ended_on = CASE WHEN $2::text IN ('ENDED','TERMINATED') THEN CURRENT_DATE ELSE ended_on END,
              end_reason = COALESCE($3, end_reason)
        WHERE id = $1`,
      [id, status, endReason],
    );
  }

  listChecks(engagementId: string): Promise<ComplianceCheckRow[]> {
    return this.db.query<ComplianceCheckRow>(
      `SELECT id, engagement_id, check_code, result, checked_by, checked_at, note
         FROM engagement_compliance_checks WHERE engagement_id = $1 ORDER BY check_code`,
      [engagementId],
    );
  }

  async seedChecks(engagementId: string, codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    await this.db.tx(async (client) => {
      for (const code of codes) {
        await client.query(
          `INSERT INTO engagement_compliance_checks (engagement_id, check_code) VALUES ($1, $2)
           ON CONFLICT (engagement_id, check_code) DO NOTHING`,
          [engagementId, code],
        );
      }
    });
  }

  async setCheck(
    engagementId: string, code: string, result: string, checkedBy: string, note: string | null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO engagement_compliance_checks (engagement_id, check_code, result, checked_by, checked_at, note)
       VALUES ($1,$2,$3,$4,now(),$5)
       ON CONFLICT (engagement_id, check_code) DO UPDATE
         SET result = EXCLUDED.result, checked_by = EXCLUDED.checked_by,
             checked_at = now(), note = EXCLUDED.note`,
      [engagementId, code, result, checkedBy, note],
    );
  }
}
