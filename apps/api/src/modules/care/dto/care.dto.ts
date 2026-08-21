import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length,
} from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

const SERVICE_TYPES = ['H12', 'H24', 'DAY', 'NIGHT'] as const;

/**
 * 간병 신청 (SCR-303).
 *
 * `supportItems`는 카탈로그 코드만 받습니다. 의료행위는 카탈로그에 **항목 자체가
 * 없으므로** 여기로 들어올 수 없습니다 (§6-2). 자유 입력은 `cautions` 하나뿐이고
 * 그것만 스캔 대상입니다.
 */
export class CreateCareRequestDto {
  @IsOptional() @IsUUID() hospitalId?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsString() @Length(1, 120) ward?: string;
  @IsIn(SERVICE_TYPES) serviceType: (typeof SERVICE_TYPES)[number];
  /** 미지정 시 3교대가 기본값입니다. 24시간 상주는 운영자 승인 대상 (§5.12). */
  @IsOptional() @IsString() @Length(1, 24) shiftPatternCode?: string;
  @IsISO8601() startAt: string;
  @IsOptional() @IsISO8601() endAt?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) supportItems?: string[];
  @IsOptional() @IsString() @Length(1, 64) mobilityLevel?: string;
  /** 자유 입력. 의료행위 요구가 감지되면 OPS_REVIEW로 갑니다 — 거절이 아닙니다. */
  @IsOptional() @IsString() @Length(1, 2000) cautions?: string;
}

const REQUEST_STATUS = [
  'DRAFT', 'SUBMITTED', 'MATCHING', 'OFFER_SENT', 'ASSIGNED',
  'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'OPS_REVIEW', 'ISSUE',
] as const;

export class CareRequestStatusDto {
  @IsIn(REQUEST_STATUS) status: (typeof REQUEST_STATUS)[number];
}

export class OfferAssignmentDto {
  @IsUUID() caregiverId: string;
  @IsOptional() @IsString() @Length(4, 8) shiftStartTime?: string;
  @IsOptional() @IsString() @Length(4, 8) shiftEndTime?: string;
}

const ASSIGNMENT_STATUS = [
  'OFFERED', 'ACCEPTED', 'DECLINED', 'ASSIGNED',
  'IN_SERVICE', 'COMPLETED', 'CANCELLED', 'DISPUTED',
] as const;

export class AssignmentStatusDto {
  @IsIn(ASSIGNMENT_STATUS) status: (typeof ASSIGNMENT_STATUS)[number];
}

export class CareRequestQueryDto {
  @IsOptional() @IsIn(REQUEST_STATUS) status?: (typeof REQUEST_STATUS)[number];
  @IsOptional() @Type(() => Boolean) board?: boolean;
}

// ── 응답 ────────────────────────────────────────────────────────────────────

export class CareRequestDto {
  /** 신청한 보호자. 'self'는 역할이 아니라 관계입니다. */
  @ScopeOwner() ownerUserId: string;

  @Scope('self', 'admin', 'org') id: string;
  @Scope('self', 'admin', 'org') hospitalName: string | null;
  @Scope('self', 'admin', 'org') ward: string | null;
  @Scope('self', 'admin', 'org') serviceType: string;
  @Scope('self', 'admin', 'org') shiftPatternCode: string | null;
  @Scope('self', 'admin', 'org') startAt: Date;
  @Scope('self', 'admin', 'org') endAt: Date | null;
  @Scope('self', 'admin', 'org') supportItems: string[] | null;
  @Scope('self', 'admin', 'org') mobilityLevel: string | null;
  @Scope('self', 'admin', 'org') status: string;
  @Scope('self', 'admin', 'org') slaDueAt: Date | null;

  /** 자유 입력은 본인과 운영자만. 간병사에게는 별도 요약이 갑니다 (docs/11 §3.2). */
  @Scope('self', 'admin') cautions: string | null;
  /** 감지된 업무범위 카테고리. 운영자가 무엇을 설명해야 하는지 알아야 합니다. */
  @Scope('self', 'admin') restrictedFlags: string[] | null;
  /** 24시간 상주 승인자. 운영자만 봅니다. */
  @Scope('admin') shiftApprovedBy: string | null;
}

/**
 * 간병사 카드 (SCR-304).
 *
 * **국적 필드가 없습니다** (§6-21, 2026-08-21 확정). 여기에 추가하지 마세요 —
 * 보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한
 * 인력이 국적 때문에 선택받지 못합니다. 실명도 나가지 않습니다.
 */
export class CaregiverCardDto {
  @Scope('self', 'admin', 'org') caregiverId: string;
  @Scope('self', 'admin', 'org') displayCode: string;
  @Scope('self', 'admin', 'org') experienceYrs: number;
  @Scope('self', 'admin', 'org') ratingAvg: number | null;
  @Scope('self', 'admin', 'org') completedCount: number;
  @Scope('self', 'admin', 'org') available: boolean;
}

export class CareMatchResultDto {
  /** 이 요청을 신청한 보호자. 'self'는 역할이 아니라 관계입니다. */
  @ScopeOwner() ownerUserId: string;

  @Scope('self', 'admin', 'org') candidates: CaregiverCardDto[];
  /** 제외 건수와 사유를 함께 냅니다 — '간병사가 없다'와 '검증이 안 끝났다'는 다릅니다. */
  @Scope('self', 'admin', 'org') excludedCount: number;
  @Scope('admin') excludedReasons: Record<string, number>;
}

export class CareAssignmentDto {
  /**
   * 이 배정이 속한 요청의 신청자.
   *
   * 간병사가 아니라 **보호자**입니다 — 간병사는 자기 배정을 보지만 그 경로는
   * Caregiver App(SCR-401~404)이고 거기서는 환자 실명이 나가지 않습니다
   * (docs/11 §3.2). 여기서 self는 신청자 관계입니다.
   */
  @ScopeOwner() ownerUserId: string;

  @Scope('self', 'admin', 'org') id: string;
  @Scope('self', 'admin', 'org') careRequestId: string;
  @Scope('self', 'admin', 'org') caregiverDisplayCode: string;
  @Scope('self', 'admin', 'org') status: string;
  @Scope('self', 'admin', 'org') offeredAt: Date;
  @Scope('self', 'admin', 'org') respondedAt: Date | null;
  @Scope('self', 'admin', 'org') shiftStartTime: string | null;
  @Scope('self', 'admin', 'org') shiftEndTime: string | null;
  /** 운영자 확인자. 이것이 채워져야 확정입니다 (§6-4). */
  @Scope('admin') confirmedBy: string | null;
  @Scope('admin') caregiverId: string;
}
