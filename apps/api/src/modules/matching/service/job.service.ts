import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { JobRepository, type JobRow } from '../repository/job.repository';
import { jobMachine, type JobStatus } from '../state/job.state';

@Injectable()
export class JobService {
  constructor(
    private readonly repo: JobRepository,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<JobRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'job', targetId: id });
    return row;
  }

  list(filter: Parameters<JobRepository['list']>[0], page = 1, size = 20) {
    return this.repo.list(filter, page, size);
  }

  async create(input: Record<string, unknown>, mandatoryRequirements: string[]): Promise<JobRow> {
    const job = await this.repo.create(input);
    for (const req of mandatoryRequirements) await this.repo.addRequirement(job.id, req, true);
    return job;
  }

  async changeStatus(id: string, to: JobStatus, actorUserId: string): Promise<JobRow> {
    const before = await this.getById(id);
    jobMachine.assert(before.status, to);
    await this.repo.setStatus(id, to);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'job', targetId: id,
      before: { status: before.status }, after: { status: to },
    });
    return this.getById(id);
  }

  /**
   * 급여 공개 범위 적용.
   *
   * 마스킹이 아니라 값을 넣지 않는다. 범위를 숨긴다면서 필드에 값을 채워 보내면
   * 클라이언트만 안 보여줄 뿐 데이터는 이미 나간 것이다 (docs/09 §4.1-4).
   *
   * @param unlocked 이 후보자가 이 공고에 매칭·지원해 급여를 볼 자격이 있는가
   */
  applySalaryVisibility(job: JobRow, viewerIsOrgOrAdmin: boolean, unlocked: boolean): { min: number | null; max: number | null } {
    if (viewerIsOrgOrAdmin) return { min: job.salary_min, max: job.salary_max };
    switch (job.salary_visibility) {
      case 'PUBLIC': return { min: job.salary_min, max: job.salary_max };
      case 'AFTER_MATCH': return unlocked ? { min: job.salary_min, max: job.salary_max } : { min: null, max: null };
      case 'NEGOTIABLE':
      default: return { min: null, max: null };
    }
  }
}
