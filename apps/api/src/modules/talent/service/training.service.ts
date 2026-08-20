import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { TrainingRepository, type EnrollmentRow, type TrainingProgramRow } from '../repository/training.repository';

/**
 * 교육. SCR-106.
 *
 * MVP에서 LMS를 직접 만들지 않는다 (SCR-106 notes). 진도율은 교육 파트너가
 * API 또는 CSV로 올리는 값을 저장만 한다. 콘텐츠 제작은 Phase 4 이후다.
 */
@Injectable()
export class TrainingService {
  constructor(private readonly repo: TrainingRepository) {}

  listPrograms(trackId: string | null): Promise<TrainingProgramRow[]> {
    return this.repo.listPrograms(trackId);
  }

  listEnrollments(candidateId: string): Promise<EnrollmentRow[]> {
    return this.repo.listEnrollments(candidateId);
  }

  async enroll(candidateId: string, programCode: string): Promise<EnrollmentRow[]> {
    const program = await this.repo.findProgramByCode(programCode);
    if (!program) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'training_program', programCode });
    await this.repo.enroll(candidateId, program.id);
    return this.repo.listEnrollments(candidateId);
  }

  /**
   * 진도율 갱신. 파트너가 올리는 값이므로 범위만 검증하고 그대로 저장한다.
   * 100%면 COMPLETED로 넘어가고 completed_at이 찍힌다.
   */
  async updateProgress(enrollmentId: string, progressRate: number, certificateKey: string | null): Promise<EnrollmentRow> {
    const existing = await this.repo.findEnrollment(enrollmentId);
    if (!existing) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'training_enrollment', targetId: enrollmentId });
    if (progressRate < 0 || progressRate > 100) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'training_enrollment', reason: 'progressRate must be 0..100' });
    }
    await this.repo.updateProgress(enrollmentId, progressRate, certificateKey);
    return (await this.repo.findEnrollment(enrollmentId))!;
  }
}
