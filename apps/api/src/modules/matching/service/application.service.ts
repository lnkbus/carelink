import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { NotificationService } from '../../ops/service/notification.service';
import { ApplicationRepository, type ApplicationRow, type InterviewRow } from '../repository/application.repository';
import { JobRepository } from '../repository/job.repository';
import { applicationMachine, STATUSES_REQUIRING_NOTE, type ApplicationStatus } from '../state/application.state';
import { interviewMachine, type InterviewStatus } from '../state/interview.state';
import { isJobOpen } from '../state/job.state';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly repo: ApplicationRepository,
    private readonly jobs: JobRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  listByCandidate(candidateId: string): Promise<ApplicationRow[]> { return this.repo.listByCandidate(candidateId); }
  listByJob(jobId: string): Promise<ApplicationRow[]> { return this.repo.listByJob(jobId); }

  async getById(id: string): Promise<ApplicationRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'application', targetId: id });
    return row;
  }

  async apply(jobId: string, candidateId: string, actorUserId: string): Promise<ApplicationRow> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'job', targetId: jobId });
    if (!isJobOpen(job.status)) throw new DomainError('MATCHING_JOB_NOT_OPEN', { jobId, status: job.status });

    const created = await this.repo.create(jobId, candidateId);
    if (!created) throw new DomainError('MATCHING_ALREADY_APPLIED', { jobId, candidateId });

    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'application', targetId: created.id,
      after: { status: 'APPLIED', jobId },
    });
    return created;
  }

  /**
   * 상태 전이. 변경은 반드시 알림과 함께 나간다 —
   * 지원자가 "연락이 없다"고 느끼는 순간 이탈한다 (SCR-109 notes).
   */
  async transition(
    applicationId: string, to: ApplicationStatus, note: string | null, actorUserId: string,
  ): Promise<ApplicationRow> {
    const before = await this.getById(applicationId);
    applicationMachine.assert(before.status, to);

    // 불합격에는 사유가 필수다. 무엇을 보완해야 하는지 모르면 다음 지원도 같은 이유로 떨어진다.
    if (STATUSES_REQUIRING_NOTE.includes(to) && !note) {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: 'matching.application', to,
        reason: 'a rejection must carry a reason (SCR-109)',
      });
    }

    await this.repo.setStatus(applicationId, to, note);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'application', targetId: applicationId,
      before: { status: before.status }, after: { status: to, note },
    });
    await this.notifications.enqueue(before.candidate_user_id, `MATCHING_APPLICATION_${to}`, {
      dedupeKey: `${applicationId}:${to}`,
      applicationId, jobTitle: before.job_title, organizationName: before.organization_name,
      ...(note ? { note } : {}),
    });
    return this.getById(applicationId);
  }

  // ── 면접 ──────────────────────────────────────────────────────────────────

  listInterviews(organizationId: string, from: Date, to: Date): Promise<InterviewRow[]> {
    return this.repo.listInterviewsByOrg(organizationId, from, to);
  }

  /** 면접 요청. 지원 상태도 함께 옮긴다 — 두 값이 어긋나면 화면이 서로 다른 말을 한다. */
  async requestInterview(input: {
    applicationId: string; scheduledAt: Date | null; mode: string | null;
    interviewer: string | null; actorUserId: string;
  }): Promise<InterviewRow> {
    const app = await this.getById(input.applicationId);
    if (app.status === 'APPLIED') {
      await this.transition(input.applicationId, 'UNDER_REVIEW', null, input.actorUserId);
    }
    await this.transition(input.applicationId, 'INTERVIEW_REQUESTED', null, input.actorUserId);

    return this.repo.createInterview({
      applicationId: app.id, jobId: app.job_id, candidateId: app.candidate_id,
      scheduledAt: input.scheduledAt, mode: input.mode, interviewer: input.interviewer,
    });
  }

  /**
   * 면접 상태 전이.
   *
   * CONFIRMED는 후보자가 요청을 수락했다는 뜻이고, 그 순간 기관에 실명·연락처가
   * 열린다 (docs/02 §5.2). 그래서 이 전이는 후보자만 할 수 있다.
   */
  async transitionInterview(
    interviewId: string, to: InterviewStatus, memo: string | null, actorUserId: string,
  ): Promise<InterviewRow> {
    const before = await this.repo.findInterview(interviewId);
    if (!before) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'interview', targetId: interviewId });
    interviewMachine.assert(before.status, to);

    await this.repo.setInterviewStatus(interviewId, to, memo);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'interview', targetId: interviewId,
      before: { status: before.status }, after: { status: to },
    });

    if (to === 'COMPLETED' && before.application_id) {
      const app = await this.repo.findById(before.application_id);
      if (app?.status === 'INTERVIEW_REQUESTED') {
        await this.transition(before.application_id, 'INTERVIEW_DONE', null, actorUserId);
      }
    }
    return (await this.repo.findInterview(interviewId))!;
  }

  getInterview(id: string): Promise<InterviewRow | null> { return this.repo.findInterview(id); }

  staleApplications(days: number) { return this.repo.staleApplications(days); }
  hasUnlockedInterview(orgId: string, candidateId: string) { return this.repo.hasUnlockedInterview(orgId, candidateId); }
  unlockedCandidateIds(orgId: string, ids: string[]) { return this.repo.unlockedCandidateIds(orgId, ids); }
}
