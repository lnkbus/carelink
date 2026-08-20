import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

export type EnrollmentStatus = 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED' | 'EXPIRED';

export interface TrainingProgramRow {
  id: string; code: string; name: string; program_type: string;
  track_id: string | null; partner_id: string | null;
  total_hours: number | null; is_mandatory: boolean;
}

export interface EnrollmentRow {
  id: string; candidate_id: string; program_id: string;
  status: EnrollmentStatus; progress_rate: string;
  enrolled_at: Date; completed_at: Date | null; certificate_key: string | null;
  program_code: string; program_name: string; program_type: string; total_hours: number | null;
}

@Injectable()
export class TrainingRepository {
  constructor(private readonly db: DbService) {}

  listPrograms(trackId: string | null): Promise<TrainingProgramRow[]> {
    return this.db.query<TrainingProgramRow>(
      `SELECT id, code, name, program_type, track_id, partner_id, total_hours, is_mandatory
         FROM training_programs
        WHERE track_id IS NULL OR $1::uuid IS NULL OR track_id = $1
        ORDER BY is_mandatory DESC, program_type, code`,
      [trackId],
    );
  }

  findProgramByCode(code: string): Promise<TrainingProgramRow | null> {
    return this.db.one<TrainingProgramRow>(
      `SELECT id, code, name, program_type, track_id, partner_id, total_hours, is_mandatory
         FROM training_programs WHERE code = $1`,
      [code],
    );
  }

  listEnrollments(candidateId: string): Promise<EnrollmentRow[]> {
    return this.db.query<EnrollmentRow>(
      `SELECT e.id, e.candidate_id, e.program_id, e.status, e.progress_rate,
              e.enrolled_at, e.completed_at, e.certificate_key,
              p.code AS program_code, p.name AS program_name,
              p.program_type, p.total_hours
         FROM training_enrollments e JOIN training_programs p ON p.id = e.program_id
        WHERE e.candidate_id = $1
        ORDER BY p.is_mandatory DESC, e.enrolled_at`,
      [candidateId],
    );
  }

  async enroll(candidateId: string, programId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO training_enrollments (candidate_id, program_id) VALUES ($1, $2)
       ON CONFLICT (candidate_id, program_id) DO NOTHING`,
      [candidateId, programId],
    );
  }

  /**
   * 진도율 갱신. 교육 파트너가 올리는 값을 저장만 한다 — LMS를 직접 만들지 않는다
   * (SCR-106 notes). 100%면 COMPLETED로 넘긴다.
   */
  async updateProgress(enrollmentId: string, progressRate: number, certificateKey: string | null): Promise<void> {
    await this.db.query(
      // $2를 NUMERIC 대입과 정수 비교에 함께 쓰면 타입 추론이 깨진다
      // (inconsistent types deduced for parameter). 캐스팅을 명시한다.
      `UPDATE training_enrollments
          SET progress_rate = $2::numeric,
              status = CASE
                         WHEN $2::numeric >= 100 THEN 'COMPLETED'::enrollment_status
                         WHEN $2::numeric > 0    THEN 'IN_PROGRESS'::enrollment_status
                         ELSE status
                       END,
              completed_at = CASE WHEN $2::numeric >= 100
                                  THEN COALESCE(completed_at, now()) ELSE completed_at END,
              certificate_key = COALESCE($3, certificate_key)
        WHERE id = $1`,
      [enrollmentId, progressRate, certificateKey],
    );
  }

  findEnrollment(id: string): Promise<EnrollmentRow | null> {
    return this.db.one<EnrollmentRow>(
      `SELECT e.id, e.candidate_id, e.program_id, e.status, e.progress_rate,
              e.enrolled_at, e.completed_at, e.certificate_key,
              p.code AS program_code, p.name AS program_name, p.program_type, p.total_hours
         FROM training_enrollments e JOIN training_programs p ON p.id = e.program_id
        WHERE e.id = $1`,
      [id],
    );
  }
}
