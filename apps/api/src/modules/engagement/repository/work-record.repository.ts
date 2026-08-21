import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

export interface WorkRecordRow {
  id: string; engagement_id: string; source_type: string; source_id: string | null;
  work_date: Date; started_at: Date | null; ended_at: Date | null;
  break_minutes: number; normal_minutes: number; night_minutes: number;
  overtime_minutes: number; holiday_minutes: number;
  approved_by: string | null; approved_at: Date | null;
  correction_of: string | null; created_at: Date;
}

/**
 * 집계에 필요한 사실.
 *
 * **`service_logs`에서 시작·종료를 가져옵니다.** `care_assignments.started_at`이
 * 아니라 로그를 쓰는 이유는, 로그가 append-only라 정정 이력이 남기 때문입니다 —
 * 정산 분쟁에서 근거가 되는 것은 로그이지 배정 행의 타임스탬프가 아닙니다.
 */
export interface AssignmentWorkFacts {
  assignment_id: string; worker_user_id: string;
  engagement_id: string | null; shift_pattern_code: string | null;
  started_at: Date | null; ended_at: Date | null;
}

const COLS = `id, engagement_id, source_type, source_id, work_date, started_at, ended_at,
              break_minutes, normal_minutes, night_minutes, overtime_minutes, holiday_minutes,
              approved_by, approved_at, correction_of, created_at`;

@Injectable()
export class WorkRecordRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<WorkRecordRow | null> {
    return this.db.one<WorkRecordRow>(`SELECT ${COLS} FROM work_records WHERE id = $1`, [id]);
  }

  findBySource(sourceType: string, sourceId: string): Promise<WorkRecordRow | null> {
    // 정정본이 아니라 원본을 찾습니다 — 중복 집계 방지가 목적입니다.
    return this.db.one<WorkRecordRow>(
      `SELECT ${COLS} FROM work_records
        WHERE source_type = $1 AND source_id = $2 AND correction_of IS NULL
        LIMIT 1`,
      [sourceType, sourceId],
    );
  }

  listByEngagement(engagementId: string): Promise<WorkRecordRow[]> {
    return this.db.query<WorkRecordRow>(
      `SELECT ${COLS} FROM work_records WHERE engagement_id = $1
        ORDER BY work_date, created_at`,
      [engagementId],
    );
  }

  /**
   * 배정의 근무 사실.
   *
   * 시작·종료는 `service_logs`의 SHIFT_START/SHIFT_END에서 옵니다.
   * 정정된 로그가 있으면 **정정본**을 씁니다 — 원본은 남아 있지만
   * 집계 기준은 최신 정정본입니다.
   */
  assignmentWorkFacts(assignmentId: string): Promise<AssignmentWorkFacts | null> {
    return this.db.one<AssignmentWorkFacts>(
      `WITH latest AS (
         SELECT l.log_type, l.occurred_at,
                row_number() OVER (
                  PARTITION BY l.log_type
                  ORDER BY (l.correction_of IS NOT NULL) DESC, l.created_at DESC
                ) AS rn
           FROM service_logs l
          WHERE l.assignment_id = $1
            AND l.log_type IN ('SHIFT_START','SHIFT_END')
            -- 나중에 정정된 로그는 제외합니다.
            AND NOT EXISTS (SELECT 1 FROM service_logs c WHERE c.correction_of = l.id)
       )
       SELECT a.id AS assignment_id,
              cg.user_id AS worker_user_id,
              e.id AS engagement_id,
              r.shift_pattern_code,
              (SELECT occurred_at FROM latest WHERE log_type = 'SHIFT_START' AND rn = 1) AS started_at,
              (SELECT occurred_at FROM latest WHERE log_type = 'SHIFT_END'   AND rn = 1) AS ended_at
         FROM care_assignments a
         JOIN caregivers cg ON cg.id = a.caregiver_id
         JOIN care_requests r ON r.id = a.care_request_id
         LEFT JOIN engagements e ON e.worker_user_id = cg.user_id
                                AND e.status = 'ACTIVE'
        WHERE a.id = $1
        LIMIT 1`,
      [assignmentId],
    );
  }

  /** 집계 대상 — 완료됐는데 아직 근무 기록이 없는 배정. */
  pendingAssignments(limit = 200): Promise<{ assignment_id: string }[]> {
    return this.db.query(
      `SELECT a.id AS assignment_id
         FROM care_assignments a
        WHERE a.status = 'COMPLETED'
          AND NOT EXISTS (
            SELECT 1 FROM work_records w
             WHERE w.source_type = 'CARE_ASSIGNMENT' AND w.source_id = a.id
          )
        ORDER BY a.ended_at
        LIMIT $1`,
      [limit],
    );
  }

  async create(input: {
    engagementId: string; sourceType: string; sourceId: string | null;
    workDate: string; startedAt: string | null; endedAt: string | null;
    breakMinutes: number; normalMinutes: number; nightMinutes: number;
    overtimeMinutes: number; holidayMinutes: number; correctionOf?: string | null;
  }): Promise<WorkRecordRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO work_records
         (engagement_id, source_type, source_id, work_date, started_at, ended_at,
          break_minutes, normal_minutes, night_minutes, overtime_minutes, holiday_minutes,
          correction_of)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [input.engagementId, input.sourceType, input.sourceId, input.workDate,
       input.startedAt, input.endedAt, input.breakMinutes, input.normalMinutes,
       input.nightMinutes, input.overtimeMinutes, input.holidayMinutes,
       input.correctionOf ?? null],
    );
    return (await this.findById(row!.id))!;
  }

  async approve(id: string, approvedBy: string): Promise<void> {
    await this.db.query(
      `UPDATE work_records SET approved_by = $2, approved_at = now() WHERE id = $1`,
      [id, approvedBy],
    );
  }
}
