import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { ApplicationStatus } from '../state/application.state';
import type { InterviewStatus } from '../state/interview.state';

export interface ApplicationRow {
  id: string; job_id: string; candidate_id: string; status: ApplicationStatus;
  applied_at: Date; status_changed_at: Date; result_note: string | null;
  job_title: string | null; organization_id: string; organization_name: string;
  display_code: string; candidate_user_id: string;
}

export interface InterviewRow {
  id: string; application_id: string | null; job_id: string; candidate_id: string;
  scheduled_at: Date | null; mode: string | null; interviewer: string | null;
  status: InterviewStatus; memo: string | null; created_at: Date;
}

const APP_COLS = `a.id, a.job_id, a.candidate_id, a.status, a.applied_at, a.status_changed_at, a.result_note,
                  j.title AS job_title, j.organization_id, o.name AS organization_name,
                  c.display_code, c.user_id AS candidate_user_id`;
const APP_FROM = `FROM applications a
                    JOIN jobs j ON j.id = a.job_id
                    JOIN organizations o ON o.id = j.organization_id
                    JOIN candidates c ON c.id = a.candidate_id`;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<ApplicationRow | null> {
    return this.db.one<ApplicationRow>(`SELECT ${APP_COLS} ${APP_FROM} WHERE a.id = $1`, [id]);
  }

  listByCandidate(candidateId: string): Promise<ApplicationRow[]> {
    return this.db.query<ApplicationRow>(
      `SELECT ${APP_COLS} ${APP_FROM} WHERE a.candidate_id = $1 ORDER BY a.applied_at DESC`,
      [candidateId],
    );
  }

  listByJob(jobId: string): Promise<ApplicationRow[]> {
    return this.db.query<ApplicationRow>(
      `SELECT ${APP_COLS} ${APP_FROM} WHERE a.job_id = $1 ORDER BY a.applied_at DESC`,
      [jobId],
    );
  }

  async create(jobId: string, candidateId: string): Promise<ApplicationRow | null> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO applications (job_id, candidate_id) VALUES ($1, $2)
       ON CONFLICT (job_id, candidate_id) DO NOTHING RETURNING id`,
      [jobId, candidateId],
    );
    return row ? this.findById(row.id) : null;
  }

  async setStatus(id: string, status: ApplicationStatus, note: string | null): Promise<void> {
    await this.db.query(
      `UPDATE applications SET status = $2::application_status, status_changed_at = now(),
              result_note = COALESCE($3, result_note)
        WHERE id = $1`,
      [id, status, note],
    );
  }

  /** 상태 변경 후 n일 무응답. application-no-response 잡이 쓴다. */
  staleApplications(days: number): Promise<ApplicationRow[]> {
    return this.db.query<ApplicationRow>(
      `SELECT ${APP_COLS} ${APP_FROM}
        WHERE a.status IN ('APPLIED','UNDER_REVIEW','INTERVIEW_REQUESTED','INTERVIEW_DONE','OFFERED')
          AND a.status_changed_at <= now() - ($1 || ' days')::interval
        ORDER BY a.status_changed_at`,
      [days],
    );
  }

  // ── 면접 ──────────────────────────────────────────────────────────────────

  findInterview(id: string): Promise<InterviewRow | null> {
    return this.db.one<InterviewRow>(
      `SELECT id, application_id, job_id, candidate_id, scheduled_at, mode, interviewer, status, memo, created_at
         FROM interviews WHERE id = $1`,
      [id],
    );
  }

  listInterviewsByOrg(organizationId: string, from: Date, to: Date): Promise<InterviewRow[]> {
    return this.db.query<InterviewRow>(
      `SELECT i.id, i.application_id, i.job_id, i.candidate_id, i.scheduled_at, i.mode,
              i.interviewer, i.status, i.memo, i.created_at
         FROM interviews i JOIN jobs j ON j.id = i.job_id
        WHERE j.organization_id = $1
          AND (i.scheduled_at IS NULL OR i.scheduled_at BETWEEN $2 AND $3)
        ORDER BY i.scheduled_at NULLS LAST`,
      [organizationId, from, to],
    );
  }

  async createInterview(input: {
    applicationId: string; jobId: string; candidateId: string;
    scheduledAt: Date | null; mode: string | null; interviewer: string | null;
  }): Promise<InterviewRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO interviews (application_id, job_id, candidate_id, scheduled_at, mode, interviewer)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [input.applicationId, input.jobId, input.candidateId, input.scheduledAt, input.mode, input.interviewer],
    );
    return (await this.findInterview(row!.id))!;
  }

  async setInterviewStatus(id: string, status: InterviewStatus, memo: string | null): Promise<void> {
    await this.db.query(
      `UPDATE interviews SET status = $2::interview_status, memo = COALESCE($3, memo) WHERE id = $1`,
      [id, status, memo],
    );
  }

  /**
   * 이 기관이 이 후보자의 실명·연락처를 볼 수 있는가.
   *
   * 후보자가 면접 요청을 수락(CONFIRMED 이상)한 건이 있어야 한다 (docs/02 §5.2).
   * 이 게이트가 뚫리면 플랫폼을 우회한 직거래가 발생한다.
   */
  async hasUnlockedInterview(organizationId: string, candidateId: string): Promise<boolean> {
    const row = await this.db.one<{ unlocked: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM interviews i JOIN jobs j ON j.id = i.job_id
          WHERE j.organization_id = $1 AND i.candidate_id = $2
            AND i.status IN ('CONFIRMED','COMPLETED','NO_SHOW')
       ) AS unlocked`,
      [organizationId, candidateId],
    );
    return row?.unlocked ?? false;
  }

  /** 여러 후보자를 한 번에. 검색 결과 목록에서 후보자 수만큼 쿼리하지 않도록. */
  async unlockedCandidateIds(organizationId: string, candidateIds: string[]): Promise<Set<string>> {
    if (candidateIds.length === 0) return new Set();
    const rows = await this.db.query<{ candidate_id: string }>(
      `SELECT DISTINCT i.candidate_id FROM interviews i JOIN jobs j ON j.id = i.job_id
        WHERE j.organization_id = $1 AND i.candidate_id = ANY($2::uuid[])
          AND i.status IN ('CONFIRMED','COMPLETED','NO_SHOW')`,
      [organizationId, candidateIds],
    );
    return new Set(rows.map((r) => r.candidate_id));
  }
}
