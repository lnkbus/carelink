import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Min,
} from 'class-validator';
import { Scope, ScopeOwner, ScopeUnlock } from '../../../core/scope/scope.decorator';

const JOB_STATUS = ['DRAFT', 'OPEN', 'PAUSED', 'FILLED', 'CLOSED', 'EXPIRED'] as const;
const APP_STATUS = ['APPLIED','UNDER_REVIEW','INTERVIEW_REQUESTED','INTERVIEW_DONE','OFFERED','ACCEPTED','REJECTED','WITHDRAWN'] as const;
const INTERVIEW_STATUS = ['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
const SALARY_VISIBILITY = ['PUBLIC', 'AFTER_MATCH', 'NEGOTIABLE'] as const;

// ── 요청 ────────────────────────────────────────────────────────────────────

export class CreateJobDto {
  @IsUUID() trackId: string;
  @IsOptional() @IsString() @Length(1, 200) title?: string;
  @IsInt() @Min(1) headcount: number;
  @IsString() @Length(1, 120) region: string;
  @IsOptional() @IsString() @Length(1, 64) employmentType?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsBoolean() dormProvided?: boolean;
  @IsOptional() @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @IsInt() @Min(0) salaryMax?: number;
  /**
   * 급여 공개 범위. 기관은 공개를 꺼리고 후보자는 요구한다.
   * 이 값이 지원 전환율에 직접 영향을 주므로 A/B 측정 대상이다 (SCR-202 notes).
   */
  @IsOptional() @IsIn(SALARY_VISIBILITY) salaryVisibility?: (typeof SALARY_VISIBILITY)[number];
  @IsOptional() @IsNumber() @Min(0) minExperienceYrs?: number;
  @IsOptional() @IsString() @Length(1, 32) languageLevel?: string;
  @IsOptional() @IsString() extraConditions?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mandatoryRequirements?: string[];
}

export class UpdateJobStatusDto {
  @IsIn(JOB_STATUS) status: (typeof JOB_STATUS)[number];
}

export class JobQueryDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsIn(JOB_STATUS) status?: (typeof JOB_STATUS)[number];
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsUUID() trackId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) size?: number;
}

export class TransitionApplicationDto {
  @IsIn(APP_STATUS) status: (typeof APP_STATUS)[number];
  /** REJECTED에는 반드시 있어야 한다 (SCR-109). */
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
}

export class RequestInterviewDto {
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsIn(['ONSITE', 'VIDEO', 'PHONE']) mode?: string;
  @IsOptional() @IsString() @Length(1, 120) interviewer?: string;
}

export class TransitionInterviewDto {
  @IsIn(INTERVIEW_STATUS) status: (typeof INTERVIEW_STATUS)[number];
  @IsOptional() @IsString() @Length(1, 1000) memo?: string;
}

// ── 응답 ────────────────────────────────────────────────────────────────────

export class JobDto {
  @Scope('public', 'admin', 'org', 'org_masked') id: string;
  @Scope('public', 'admin', 'org', 'org_masked') title: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') organizationId: string;
  @Scope('public', 'admin', 'org', 'org_masked') organizationName: string;
  @Scope('public', 'admin', 'org', 'org_masked') trackCode: string;
  @Scope('public', 'admin', 'org', 'org_masked') region: string;
  @Scope('public', 'admin', 'org', 'org_masked') employmentType: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') startDate: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') dormProvided: boolean;
  @Scope('public', 'admin', 'org', 'org_masked') headcount: number;
  @Scope('public', 'admin', 'org', 'org_masked') status: string;
  @Scope('public', 'admin', 'org', 'org_masked') minExperienceYrs: number;
  @Scope('public', 'admin', 'org', 'org_masked') languageLevel: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') extraConditions: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') salaryVisibility: string;

  /**
   * 급여는 공개 범위에 따라 값 자체를 넣지 않는다.
   * AFTER_MATCH·NEGOTIABLE이면 서비스가 null로 채워 보낸다 — 마스킹이 아니라 미포함이다.
   */
  @Scope('public', 'admin', 'org', 'org_masked') salaryMin: number | null;
  @Scope('public', 'admin', 'org', 'org_masked') salaryMax: number | null;
}

export class MatchReasonDto {
  @Scope('public', 'admin', 'org', 'org_masked') ruleCode: string;
  @Scope('public', 'admin', 'org', 'org_masked') messageKey: string;
  @Scope('public', 'admin', 'org', 'org_masked') params: Record<string, unknown>;
  @Scope('public', 'admin', 'org', 'org_masked') points: number;
  @Scope('public', 'admin', 'org', 'org_masked') maxPoints: number;
}

/**
 * 매칭 결과. 점수는 항상 근거와 함께 나간다 (§5.6 · docs/09 §4.1-3).
 * 실명은 없다 — 기관은 면접 수락 전까지 display_code만 본다.
 */
export class MatchResultDto {
  @ScopeUnlock('org') orgUnlocked: boolean;
  @Scope('admin', 'org', 'org_masked') candidateId: string;
  @Scope('admin', 'org', 'org_masked') displayCode: string;
  @Scope('admin', 'org', 'org_masked') score: number;
  @Scope('admin', 'org', 'org_masked') reasons: MatchReasonDto[];
  @Scope('admin', 'org', 'org_masked') missingRequirements: MatchReasonDto[];
  /** 면접 수락 후에만 열린다. */
  @Scope('admin', 'org') candidateName: string | null;
}

/** 제외 사유. 차단은 항상 사유와 함께 보여준다 (docs/09 §4.1-2). */
export class MatchExclusionDto {
  @Scope('admin', 'org', 'org_masked') displayCode: string;
  @Scope('admin', 'org', 'org_masked') filterCode: string;
  @Scope('admin', 'org', 'org_masked') reasonKey: string;
  @Scope('admin', 'org', 'org_masked') params: Record<string, unknown>;
  @Scope('admin', 'org', 'org_masked') severity: string;
  /** 후보자 id는 제외 건에서 기관에 주지 않는다 — 누가 왜 막혔는지는 운영자 영역이다. */
  @Scope('admin') candidateId: string;
}

export class MatchRunDto {
  @Scope('admin', 'org', 'org_masked') jobId: string;
  @Scope('admin', 'org', 'org_masked') matched: MatchResultDto[];
  @Scope('admin', 'org', 'org_masked') excluded: MatchExclusionDto[];
  @Scope('admin', 'org', 'org_masked') scanned: number;
  /** SCR-504 하단 요약 바 — 제안 대상과 제외 건수·사유를 함께. */
  @Scope('admin', 'org', 'org_masked') excludedCount: number;
}

export class ApplicationDto {
  @ScopeOwner() ownerUserId: string;
  @ScopeUnlock('org') orgUnlocked: boolean;
  @Scope('self', 'admin', 'org', 'org_masked') id: string;
  @Scope('self', 'admin', 'org', 'org_masked') jobId: string;
  @Scope('self', 'admin', 'org', 'org_masked') jobTitle: string | null;
  @Scope('self', 'admin', 'org', 'org_masked') organizationName: string;
  @Scope('self', 'admin', 'org', 'org_masked') status: string;
  @Scope('self', 'admin', 'org', 'org_masked') appliedAt: Date;
  @Scope('self', 'admin', 'org', 'org_masked') statusChangedAt: Date;
  /** 불합격 사유는 후보자 본인과 운영자·기관이 본다. */
  @Scope('self', 'admin', 'org', 'org_masked') resultNote: string | null;
  @Scope('admin', 'org', 'org_masked') displayCode: string;
  @Scope('admin', 'org') candidateId: string;
}

export class InterviewDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org', 'org_masked') id: string;
  @Scope('self', 'admin', 'org', 'org_masked') jobId: string;
  @Scope('self', 'admin', 'org', 'org_masked') status: string;
  @Scope('self', 'admin', 'org', 'org_masked') scheduledAt: Date | null;
  @Scope('self', 'admin', 'org', 'org_masked') mode: string | null;
  @Scope('self', 'admin', 'org', 'org_masked') interviewer: string | null;
  @Scope('admin', 'org') memo: string | null;
  @Scope('admin', 'org') candidateId: string;
}

export class PagedJobsDto {
  @Scope('public', 'admin', 'org', 'org_masked') items: JobDto[];
  @Scope('public', 'admin', 'org', 'org_masked') total: number;
  @Scope('public', 'admin', 'org', 'org_masked') page: number;
  @Scope('public', 'admin', 'org', 'org_masked') size: number;
}
