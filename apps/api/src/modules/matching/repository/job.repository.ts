import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { JobStatus } from '../state/job.state';

export interface JobRow {
  id: string; organization_id: string; track_id: string; title: string | null;
  headcount: number; region: string; employment_type: string | null;
  start_date: Date | null; dorm_provided: boolean;
  salary_min: number | null; salary_max: number | null; salary_visibility: string;
  min_experience_yrs: string | null; language_level: string | null;
  extra_conditions: string | null; status: JobStatus;
  opened_at: Date | null; filled_at: Date | null; created_by: string | null; created_at: Date;
  organization_name?: string; track_code?: string;
  /** 충원 인원 (ACCEPTED 지원 건수). SCR-202의 `2/4`. */
  filled_count?: number;
}

const COLS = `j.id, j.organization_id, j.track_id, j.title, j.headcount, j.region, j.employment_type,
              j.start_date, j.dorm_provided, j.salary_min, j.salary_max, j.salary_visibility,
              j.min_experience_yrs, j.language_level, j.extra_conditions, j.status,
              j.opened_at, j.filled_at, j.created_by, j.created_at,
              o.name AS organization_name, t.code AS track_code,
              -- 충원 진행 (SCR-202 시안의 2/4 열).
              -- 기관이 이 화면에서 가장 알고 싶은 것은 '얼마나 찼나'입니다.
              -- 요청 상태(OPEN/CLOSED)만으로는 3명 중 0명인지 3명인지 모릅니다.
              (SELECT count(*) FROM applications a
                WHERE a.job_id = j.id AND a.status = 'ACCEPTED')::int AS filled_count`;
const FROM = `FROM jobs j JOIN organizations o ON o.id = j.organization_id JOIN tracks t ON t.id = j.track_id`;

@Injectable()
export class JobRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<JobRow | null> {
    return this.db.one<JobRow>(`SELECT ${COLS} ${FROM} WHERE j.id = $1`, [id]);
  }

  async list(
    filter: { organizationId?: string; status?: JobStatus; region?: string; trackId?: string; openOnly?: boolean },
    page: number, size: number,
  ): Promise<{ items: JobRow[]; total: number }> {
    const where = `WHERE ($1::uuid IS NULL OR j.organization_id = $1)
                     AND ($2::job_status IS NULL OR j.status = $2)
                     AND ($3::text IS NULL OR j.region = $3)
                     AND ($4::uuid IS NULL OR j.track_id = $4)
                     AND ($5::boolean IS NOT TRUE OR j.status = 'OPEN')`;
    const params = [filter.organizationId ?? null, filter.status ?? null, filter.region ?? null,
                    filter.trackId ?? null, filter.openOnly ?? false];
    const items = await this.db.query<JobRow>(
      `SELECT ${COLS} ${FROM} ${where} ORDER BY j.created_at DESC LIMIT $6 OFFSET $7`,
      [...params, size, (page - 1) * size],
    );
    const count = await this.db.one<{ total: string }>(`SELECT count(*) AS total ${FROM} ${where}`, params);
    return { items, total: Number(count?.total ?? 0) };
  }

  async create(input: Record<string, unknown>): Promise<JobRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO jobs (organization_id, track_id, title, headcount, region, employment_type,
                         start_date, dorm_provided, salary_min, salary_max, salary_visibility,
                         min_experience_yrs, language_level, extra_conditions, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [input.organizationId, input.trackId, input.title, input.headcount, input.region,
       input.employmentType, input.startDate, input.dormProvided, input.salaryMin, input.salaryMax,
       input.salaryVisibility, input.minExperienceYrs, input.languageLevel, input.extraConditions,
       input.createdBy],
    );
    return (await this.findById(row!.id))!;
  }

  async update(id: string, patch: Record<string, unknown>): Promise<void> {
    const cols = Object.keys(patch);
    if (cols.length === 0) return;
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await this.db.query(`UPDATE jobs SET ${sets} WHERE id = $1`, [id, ...cols.map((c) => patch[c])]);
  }

  async setStatus(id: string, status: JobStatus): Promise<void> {
    await this.db.query(
      `UPDATE jobs
          SET status = $2::job_status,
              opened_at = CASE WHEN $2::text = 'OPEN' THEN COALESCE(opened_at, now()) ELSE opened_at END,
              filled_at = CASE WHEN $2::text = 'FILLED' THEN now() ELSE filled_at END
        WHERE id = $1`,
      [id, status],
    );
  }

  listMandatoryRequirements(jobId: string): Promise<{ requirement: string }[]> {
    return this.db.query<{ requirement: string }>(
      `SELECT requirement FROM job_requirements WHERE job_id = $1 AND is_mandatory`,
      [jobId],
    );
  }

  async addRequirement(jobId: string, requirement: string, isMandatory: boolean): Promise<void> {
    await this.db.query(
      `INSERT INTO job_requirements (job_id, requirement, is_mandatory) VALUES ($1, $2, $3)`,
      [jobId, requirement, isMandatory],
    );
  }
}
