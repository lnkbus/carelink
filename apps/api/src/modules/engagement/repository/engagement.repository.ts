import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { EngagementModel } from '../strategy/engagement.strategy';
import type { EngagementStatus } from '../state/engagement.state';

export interface EngagementRow {
  id: string; worker_user_id: string; candidate_id: string | null;
  organization_id: string; track_id: string; job_id: string | null;
  model: EngagementModel; status: EngagementStatus;
  started_on: Date | null; ended_on: Date | null; end_reason: string | null;
  previous_engagement_id: string | null;
  is_dispatch: boolean;
  dispatch_started_on: Date | null;
  dispatch_permit_no: string | null; created_at: Date;
  organization_name?: string; track_code?: string; display_code?: string | null;
}

export interface ComplianceCheckRow {
  id: string; engagement_id: string; check_code: string;
  result: string; checked_by: string | null; checked_at: Date | null; note: string | null;
}

const COLS = `e.id, e.worker_user_id, e.candidate_id, e.organization_id, e.track_id, e.job_id,
              e.model, e.status, e.started_on, e.ended_on, e.end_reason,
              e.previous_engagement_id, e.is_dispatch, e.dispatch_started_on,
              e.dispatch_permit_no, e.created_at,
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
    isDispatch?: boolean; dispatchStartedOn?: string | null; dispatchPermitNo?: string | null;
  }): Promise<EngagementRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO engagements (worker_user_id, candidate_id, organization_id, track_id, job_id,
                                model, started_on, previous_engagement_id,
                                is_dispatch, dispatch_started_on, dispatch_permit_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [input.workerUserId, input.candidateId, input.organizationId, input.trackId,
       input.jobId, input.model, input.startedOn, input.previousEngagementId,
       input.isDispatch ?? false,
       // 파견 개시일을 따로 받지 않으면 배치 시작일을 씁니다. 둘이 다른 개념이지만
       // 실무상 같은 날인 경우가 대부분이고, 비어 있으면 CHECK 제약에 걸립니다.
       input.isDispatch ? (input.dispatchStartedOn ?? input.startedOn) : null,
       input.dispatchPermitNo ?? null],
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

  /**
   * 파견 누적 일수 (파견법 §6).
   *
   * **한 배치의 기간이 아니라 인력×기관 조합의 누적입니다.** 6개월 파견 후
   * 종료했다가 다시 보내면 그 6개월이 살아 있습니다. 배치 건별로만 세면
   * 종료·재배치를 반복해 2년을 우회하게 되고, 그 우회가 바로 파견법이
   * 막으려는 것입니다.
   *
   * 종료된 건은 ended_on까지, 진행 중인 건은 오늘까지 셉니다.
   */
  async dispatchDaysUsed(workerUserId: string, organizationId: string): Promise<number> {
    const row = await this.db.one<{ days: string }>(
      `SELECT COALESCE(SUM(
                GREATEST(0,
                  (COALESCE(e.ended_on, CURRENT_DATE) - e.dispatch_started_on) + 1
                )
              ), 0)::text AS days
         FROM engagements e
        WHERE e.worker_user_id = $1
          AND e.organization_id = $2
          AND e.is_dispatch
          AND e.dispatch_started_on IS NOT NULL
          AND e.status <> 'DRAFT'`,
      [workerUserId, organizationId],
    );
    return Number(row?.days ?? 0);
  }

  /**
   * 2년 한도가 가까워진 파견 건. dispatch-limit-warning 잡이 씁니다.
   *
   * 누적이 기준이므로 같은 인력×기관의 다른 배치까지 합산한 뒤 남은 일수를 냅니다.
   */
  dispatchNearingLimit(withinDays: number): Promise<{
    engagement_id: string; worker_user_id: string; organization_id: string;
    organization_name: string; display_code: string | null; days_used: number; days_left: number;
  }[]> {
    return this.db.query(
      `WITH used AS (
         SELECT e.worker_user_id, e.organization_id,
                SUM(GREATEST(0, (COALESCE(e.ended_on, CURRENT_DATE) - e.dispatch_started_on) + 1)) AS days_used
           FROM engagements e
          WHERE e.is_dispatch AND e.dispatch_started_on IS NOT NULL AND e.status <> 'DRAFT'
          GROUP BY e.worker_user_id, e.organization_id
       )
       SELECT e.id AS engagement_id, e.worker_user_id, e.organization_id,
              o.name AS organization_name, c.display_code,
              u.days_used::int AS days_used,
              (730 - u.days_used)::int AS days_left
         FROM used u
         JOIN engagements e ON e.worker_user_id = u.worker_user_id
                           AND e.organization_id = u.organization_id
                           AND e.status = 'ACTIVE' AND e.is_dispatch
         JOIN organizations o ON o.id = e.organization_id
         LEFT JOIN candidates c ON c.user_id = e.worker_user_id
        WHERE u.days_used >= (730 - $1)
        ORDER BY u.days_used DESC`,
      [withinDays],
    );
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
