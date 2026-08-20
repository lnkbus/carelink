import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, ValidateNested,
} from 'class-validator';
import { Scope, ScopeOwner, ScopeUnlock } from '../../../core/scope/scope.decorator';

// ── 응답 ────────────────────────────────────────────────────────────────────

export class CandidateTrackDto {
  @Scope('self', 'admin', 'org', 'org_masked') trackId: string;
  @Scope('self', 'admin', 'org', 'org_masked') trackCode: string;
  @Scope('self', 'admin', 'org', 'org_masked') labelKo: string;
  @Scope('self', 'admin', 'org', 'org_masked') isPrimary: boolean;
  /** NOT_SELECTED | SELECTED | IN_PROGRESS | QUALIFIED — SCR-103 states */
  @Scope('self', 'admin', 'org', 'org_masked') qualificationState: string;
}

/**
 * 후보자 프로필. scope 매트릭스는 docs/02 §5.2 · docs/11 §3.1을 그대로 옮긴 것이다.
 *
 * 기관은 두 단계로 나뉜다.
 *   org_masked — 검증 전 또는 면접 수락 전. display_code만 본다.
 *   org        — 검증 완료 + 후보자가 면접 요청을 수락한 뒤. 실명·연락처가 열린다.
 *
 * 국적과 체류자격 코드는 어느 단계에서도 기관에 나가지 않는다.
 * 기관에는 '취업 가능 여부'(employable)로 치환해 준다.
 */
export class CandidateDto {
  /** candidates.user_id. self scope 판정에만 쓰이고 응답에는 나가지 않는다. */
  @ScopeOwner() ownerUserId: string;

  /**
   * 이 기관에게 실명·연락처가 열렸는가. 참일 때만 org_masked가 org로 승격된다.
   *
   * 조건은 두 개이고 **둘 다** 참이어야 한다 — 기관 검증 완료(§6-6) 그리고
   * 후보자의 면접 수락(§5.2). 서비스가 판정하고 강제는 직렬화가 한다.
   */
  @ScopeUnlock('org') orgUnlocked: boolean;
  @Scope('self', 'admin', 'org', 'org_masked') id: string;
  /** 'Candidate #102' — 실명 대신 쓰는 익명 식별자 */
  @Scope('self', 'admin', 'org', 'org_masked') displayCode: string;

  @Scope('self', 'admin', 'org') name: string | null;
  @Scope('self', 'admin', 'org') birthDate: string | null;
  @Scope('self', 'admin', 'org') phone: string | null;

  /**
   * [PII 준함] 본인과 운영자만. SCR-104의 data에 포함된 항목이라 본인은 봐야 한다.
   * 금지되는 것은 '기관' 노출이다 (docs/07 §2.2). 매칭 로직에서도 참조하지 않는다 (§5.10).
   */
  @Scope('self', 'admin') nationality: string | null;
  /** [PII] 본인과 운영자만. 기관에는 employable로 치환해 내보낸다 (§6-12). */
  @Scope('self', 'admin') visaStatusCode: string | null;
  @Scope('self', 'admin') visaExpiresOn: string | null;
  /** 체류자격 만료까지 남은 일수. 만료는 카운트다운으로 보여준다 (docs/09 §4.1-5). */
  @Scope('self', 'admin') visaExpiresInDays: number | null;

  /** 기관용 치환값 — 원본 체류자격 대신 '취업 가능 여부'만. */
  @Scope('admin', 'org', 'org_masked') employable: boolean | null;
  @Scope('admin', 'org', 'org_masked') employabilityReasonKey: string | null;

  @Scope('self', 'admin', 'org', 'org_masked') gender: string | null;
  @Scope('self', 'admin', 'org', 'org_masked') currentLocation: string | null;
  @Scope('self', 'admin', 'org', 'org_masked') preferredRegions: string[] | null;
  @Scope('self', 'admin', 'org', 'org_masked') employmentTypes: string[] | null;
  @Scope('self', 'admin', 'org', 'org_masked') dormRequired: boolean;
  @Scope('self', 'admin', 'org', 'org_masked') availableFrom: string | null;
  @Scope('self', 'admin', 'org', 'org_masked') status: string;
  @Scope('self', 'admin', 'org', 'org_masked') tracks: CandidateTrackDto[];

  @Scope('admin') assigneeId: string | null;
  @Scope('admin') channelId: string | null;
  @Scope('admin') campaignId: string | null;
  @Scope('admin') referredBy: string | null;
  @Scope('admin') tags: string[] | null;
}

// ── 요청 ────────────────────────────────────────────────────────────────────

export class UpdateCandidateDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @Length(1, 16) gender?: string;
  @IsOptional() @IsString() @Length(1, 120) currentLocation?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) preferredRegions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) employmentTypes?: string[];
  @IsOptional() @IsBoolean() dormRequired?: boolean;
  @IsOptional() @IsDateString() availableFrom?: string;

  /**
   * 국적·체류자격은 본인이 고칠 수 없다. 운영자가 확인한 결과만 기록한다
   * (CLAUDE.md §6-1 · §6-11 — 플랫폼은 판정하지 않고 기록한다).
   * 그래서 이 DTO에 nationality·visaStatusCode 필드가 없다.
   */
}

/** 운영자 전용. 확인한 결과를 기록한다. */
export class VerifyVisaDto {
  @IsString() @Length(1, 16) visaStatusCode: string;
  @IsOptional() @IsDateString() visaExpiresOn?: string;
  @IsOptional() @IsString() note?: string;
}

export class SelectTrackDto {
  @IsUUID() trackId: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

const CANDIDATE_STATUS = [
  'DRAFT', 'DOC_REVIEW', 'TRAINING', 'READY', 'MATCHED', 'PLACED', 'INACTIVE', 'SUSPENDED',
] as const;

/** SCR-502 단건 상태 변경. */
export class CandidateStatusDto {
  @IsIn(CANDIDATE_STATUS) status: (typeof CANDIDATE_STATUS)[number];
}

/**
 * 목록 필터.
 *
 * SCREENS의 SCR-502는 `nationality=`도 적고 있지만 넣지 않았다. 국적으로 사람을
 * 거르는 조회 경로가 생기면 그것이 운영 관행이 된다 (§5.10 · §6-13 · README §4 C5).
 */
export class CandidateListQueryDto {
  @IsOptional() @IsString() @Length(1, 64) q?: string;
  @IsOptional() @IsIn(CANDIDATE_STATUS) status?: (typeof CANDIDATE_STATUS)[number];
  @IsOptional() @IsUUID() trackId?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) size?: number;
}

export class PagedDto<T> {
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') items: T[];
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') total: number;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') page: number;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') size: number;
}

export class ConsentedNestedDto {
  @ValidateNested() @Type(() => UpdateCandidateDto) profile: UpdateCandidateDto;
}
