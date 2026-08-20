import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import { CandidateService } from '../../talent/service/candidate.service';
import {
  CreateJobDto, JobDto, JobQueryDto, MatchExclusionDto, MatchReasonDto, MatchResultDto,
  MatchRunDto, PagedJobsDto, UpdateJobStatusDto,
} from '../dto/matching.dto';
import type { JobRow } from '../repository/job.repository';
import { ApplicationService } from '../service/application.service';
import { JobService } from '../service/job.service';
import { MatchingService } from '../service/matching.service';

/** SCR-202 채용 요청 · SCR-107·108 일자리 목록/상세 · SCR-203·204·504 매칭 */
@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobs: JobService,
    private readonly matching: MatchingService,
    private readonly applications: ApplicationService,
    private readonly candidates: CandidateService,
  ) {}

  /** SCR-107 — 후보자에게는 OPEN 공고만 나간다. */
  @Get()
  async list(@CurrentViewer() viewer: Viewer, @Query() q: JobQueryDto): Promise<PagedJobsDto> {
    const page = q.page ?? 1;
    const size = Math.min(q.size ?? 20, 100);
    const privileged = viewer.scopes.includes('admin') || viewer.scopes.includes('org_masked');
    const { items, total } = await this.jobs.list(
      {
        organizationId: q.organizationId ?? (privileged ? undefined : undefined),
        status: q.status, region: q.region, trackId: q.trackId,
        openOnly: !privileged,
      },
      page, size,
    );
    return Object.assign(new PagedJobsDto(), {
      items: items.map((j) => this.toJobDto(j, viewer, false)), total, page, size,
    });
  }

  @Get(':id')
  async getOne(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string): Promise<JobDto> {
    return this.toJobDto(await this.jobs.getById(id), viewer, false);
  }

  /** SCR-202 — 채용 요청 등록. 등록 직후는 DRAFT다. */
  @Post()
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async create(@CurrentViewer() viewer: Viewer, @Body() dto: CreateJobDto): Promise<JobDto> {
    if (!viewer.organizationId && !viewer.scopes.includes('admin')) {
      throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    }
    const job = await this.jobs.create(
      {
        organizationId: viewer.organizationId,
        trackId: dto.trackId, title: dto.title ?? null, headcount: dto.headcount,
        region: dto.region, employmentType: dto.employmentType ?? null,
        startDate: dto.startDate ?? null, dormProvided: dto.dormProvided ?? false,
        salaryMin: dto.salaryMin ?? null, salaryMax: dto.salaryMax ?? null,
        salaryVisibility: dto.salaryVisibility ?? 'AFTER_MATCH',
        minExperienceYrs: dto.minExperienceYrs ?? 0, languageLevel: dto.languageLevel ?? null,
        extraConditions: dto.extraConditions ?? null, createdBy: viewer.userId,
      },
      dto.mandatoryRequirements ?? [],
    );
    return this.toJobDto(job, viewer, true);
  }

  @Patch(':id/status')
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async changeStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ): Promise<JobDto> {
    return this.toJobDto(await this.jobs.changeStatus(id, dto.status, viewer.userId!), viewer, true);
  }

  /**
   * POST /api/v1/jobs/{id}/matches — 매칭 실행 (SCR-203·204·504).
   * 하드 필터가 점수 계산 이전에 적용되고, 제외 건은 사유와 함께 반환된다.
   */
  @Post(':id/matches')
  @Roles('ORG_MEMBER', 'ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async runMatching(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MatchRunDto> {
    const result = await this.matching.runMatching(id, viewer.userId);

    // 면접을 수락한 후보자만 실명이 열린다.
    const unlocked = viewer.organizationId
      ? await this.applications.unlockedCandidateIds(viewer.organizationId, result.matched.map((m) => m.candidateId))
      : new Set<string>();

    const matched = await Promise.all(result.matched.map(async (m) => {
      const isUnlocked = unlocked.has(m.candidateId);
      const candidate = isUnlocked ? await this.candidates.getById(m.candidateId) : null;
      return Object.assign(new MatchResultDto(), {
        orgUnlocked: isUnlocked,
        candidateId: m.candidateId,
        displayCode: m.displayCode,
        score: m.score,
        reasons: m.reasons.map((r) => Object.assign(new MatchReasonDto(), r)),
        missingRequirements: m.missingRequirements.map((r) => Object.assign(new MatchReasonDto(), r)),
        candidateName: candidate?.name ?? null,
      });
    }));

    return Object.assign(new MatchRunDto(), {
      jobId: result.jobId,
      matched,
      excluded: result.excluded.map((e) => Object.assign(new MatchExclusionDto(), e)),
      scanned: result.scanned,
      excludedCount: result.excluded.length,
    });
  }

  private toJobDto(j: JobRow, viewer: Viewer, unlocked: boolean): JobDto {
    const privileged = viewer.scopes.includes('admin') || viewer.organizationId === j.organization_id;
    const salary = this.jobs.applySalaryVisibility(j, privileged, unlocked);
    return Object.assign(new JobDto(), {
      id: j.id, title: j.title, organizationId: j.organization_id,
      organizationName: j.organization_name ?? '', trackCode: j.track_code ?? '',
      region: j.region, employmentType: j.employment_type,
      startDate: j.start_date ? j.start_date.toISOString().slice(0, 10) : null,
      dormProvided: j.dorm_provided, headcount: j.headcount, status: j.status,
      minExperienceYrs: Number(j.min_experience_yrs ?? 0), languageLevel: j.language_level,
      extraConditions: j.extra_conditions, salaryVisibility: j.salary_visibility,
      salaryMin: salary.min, salaryMax: salary.max,
    });
  }
}
