import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import { CandidateService } from '../../talent/service/candidate.service';
import {
  ApplicationDto, InterviewDto, RequestInterviewDto, TransitionApplicationDto, TransitionInterviewDto,
} from '../dto/matching.dto';
import type { ApplicationRow, InterviewRow } from '../repository/application.repository';
import { ApplicationService } from '../service/application.service';
import { CANDIDATE_DRIVEN } from '../state/application.state';

/** SCR-109 지원 현황 · SCR-205 면접 관리 */
@Controller()
export class ApplicationController {
  constructor(
    private readonly applications: ApplicationService,
    private readonly candidates: CandidateService,
  ) {}

  /** SCR-109 — 본인 지원 현황 */
  @Get('candidates/me/applications')
  async myApplications(@CurrentViewer() viewer: Viewer): Promise<ApplicationDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const rows = await this.applications.listByCandidate(candidate.id);
    return rows.map((r) => toApplicationDto(r, false));
  }

  /** SCR-108 — 지원하기 */
  @Post('jobs/:jobId/apply')
  async apply(@CurrentViewer() viewer: Viewer, @Param('jobId', ParseUUIDPipe) jobId: string): Promise<ApplicationDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const row = await this.applications.apply(jobId, candidate.id, viewer.userId);
    return toApplicationDto(row, false);
  }

  /** 기관·운영자가 보는 공고별 지원자 */
  @Get('jobs/:jobId/applications')
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async byJob(
    @CurrentViewer() viewer: Viewer,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ApplicationDto[]> {
    const rows = await this.applications.listByJob(jobId);
    const unlocked = viewer.organizationId
      ? await this.applications.unlockedCandidateIds(viewer.organizationId, rows.map((r) => r.candidate_id))
      : new Set<string>();
    return rows.map((r) => toApplicationDto(r, unlocked.has(r.candidate_id)));
  }

  /**
   * 지원 상태 전이.
   *
   * 후보자가 할 수 있는 것은 철회와 수락뿐이다. 나머지는 기관·운영자가 움직인다 —
   * 지원자가 스스로 '합격'으로 바꿀 수 있으면 상태가 의미를 잃는다.
   */
  @Patch('applications/:id/status')
  async transition(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionApplicationDto,
  ): Promise<ApplicationDto> {
    const app = await this.applications.getById(id);
    const isOwner = app.candidate_user_id === viewer.userId;
    const isPrivileged = viewer.scopes.includes('admin') || viewer.organizationId === app.organization_id;

    if (isOwner && !isPrivileged && !CANDIDATE_DRIVEN.includes(dto.status)) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'candidates may only withdraw or accept', allowed: CANDIDATE_DRIVEN,
      });
    }
    if (!isOwner && !isPrivileged) throw new DomainError('IAM_ROLE_FORBIDDEN', {});

    const row = await this.applications.transition(id, dto.status, dto.note ?? null, viewer.userId!);
    return toApplicationDto(row, isPrivileged);
  }

  // ── 면접 (SCR-205) ────────────────────────────────────────────────────────

  @Get('interviews')
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async listInterviews(
    @CurrentViewer() viewer: Viewer,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<InterviewDto[]> {
    if (!viewer.organizationId) throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    const start = from ? new Date(from) : new Date(Date.now() - 7 * 86_400_000);
    const end = to ? new Date(to) : new Date(Date.now() + 30 * 86_400_000);
    const rows = await this.applications.listInterviews(viewer.organizationId, start, end);
    return rows.map((r) => toInterviewDto(r, ''));
  }

  @Post('applications/:id/interview')
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async requestInterview(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestInterviewDto,
  ): Promise<InterviewDto> {
    const app = await this.applications.getById(id);
    const row = await this.applications.requestInterview({
      applicationId: id,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      mode: dto.mode ?? null, interviewer: dto.interviewer ?? null,
      actorUserId: viewer.userId!,
    });
    return toInterviewDto(row, app.candidate_user_id);
  }

  /**
   * 면접 상태 전이.
   *
   * CONFIRMED는 후보자가 요청을 수락했다는 뜻이고, 그 순간 기관에 실명·연락처가
   * 열린다. 그래서 이 전이는 후보자 본인만 할 수 있다 — 기관이 스스로 수락 처리하면
   * 게이트가 무의미해진다.
   */
  @Patch('interviews/:id/status')
  async transitionInterview(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionInterviewDto,
  ): Promise<InterviewDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const isPrivileged = viewer.scopes.includes('admin') || Boolean(viewer.organizationId);

    const interview = await this.applications.getInterview(id);
    if (!interview) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'interview', targetId: id });

    if (dto.status === 'CONFIRMED') {
      // 수락은 후보자 본인만 한다. 기관이 대신 수락할 수 있으면
      // 실명·연락처 게이트가 무의미해진다 (docs/02 §5.2).
      if (interview.candidate_id !== candidate.id) {
        throw new DomainError('IAM_ROLE_FORBIDDEN', {
          reason: 'only the candidate can accept an interview request; acceptance unlocks their PII to the organization',
        });
      }
    } else if (interview.candidate_id !== candidate.id && !isPrivileged) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {});
    }

    const row = await this.applications.transitionInterview(id, dto.status, dto.memo ?? null, viewer.userId);
    return toInterviewDto(row, candidate.user_id);
  }
}

function toApplicationDto(r: ApplicationRow, orgUnlocked: boolean): ApplicationDto {
  return Object.assign(new ApplicationDto(), {
    ownerUserId: r.candidate_user_id,
    orgUnlocked,
    id: r.id, jobId: r.job_id, jobTitle: r.job_title,
    organizationName: r.organization_name, status: r.status,
    appliedAt: r.applied_at, statusChangedAt: r.status_changed_at,
    resultNote: r.result_note, displayCode: r.display_code, candidateId: r.candidate_id,
  });
}

function toInterviewDto(r: InterviewRow, ownerUserId: string): InterviewDto {
  return Object.assign(new InterviewDto(), {
    ownerUserId,
    id: r.id, jobId: r.job_id, status: r.status, scheduledAt: r.scheduled_at,
    mode: r.mode, interviewer: r.interviewer, memo: r.memo, candidateId: r.candidate_id,
  });
}
