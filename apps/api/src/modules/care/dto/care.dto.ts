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

// ── 근무 기록 (SCR-403 · 404 · 306) ─────────────────────────────────────────

const CHECK_METHODS = ['QR', 'GPS', 'MANUAL'] as const;

/**
 * 근무 시작·종료.
 *
 * 기본은 **QR**입니다. GPS는 위치정보 동의와 법규 검토가 선행돼야 하므로
 * 기본 경로가 아닙니다 (§6-3). `MANUAL`은 QR이 고장 났을 때의 예외이고,
 * 어떤 방법으로 찍었는지가 기록에 남아 분쟁 시 근거의 무게를 정합니다.
 */
export class ShiftBoundaryDto {
  @IsIn(CHECK_METHODS) checkMethod: (typeof CHECK_METHODS)[number];
  /** 병실 QR 토큰. checkMethod가 QR이면 필수입니다. */
  @IsOptional() @IsString() @Length(1, 200) qrToken?: string;
  /** GPS 좌표. 동의가 있을 때만 들어옵니다. */
  @IsOptional() geoPoint?: unknown;
  @IsOptional() @IsString() @Length(1, 500) memo?: string;
}

const LOG_TYPES = ['SUPPORT', 'NOTE', 'ISSUE'] as const;

export class AppendLogDto {
  @IsIn(LOG_TYPES) logType: (typeof LOG_TYPES)[number];
  /** 카탈로그 코드. 의료행위는 카탈로그에 없으므로 여기로 들어올 수 없습니다. */
  @IsOptional() @IsString() @Length(1, 64) itemCode?: string;
  @IsOptional() @IsString() @Length(1, 1000) memo?: string;
  /**
   * 정정 대상 기록.
   *
   * **기존 행을 고치지 않습니다.** 정정은 새 행이고 원본은 남습니다 (§5.4).
   * 근무시간 분쟁에서 유일한 근거가 되는 데이터라, 고칠 수 있으면 근거가 아닙니다.
   */
  @IsOptional() @IsUUID() correctionOf?: string;
}

/**
 * 간병사용 근무 상세 (SCR-403).
 *
 * **환자 실명·나이·성별·진단명이 없습니다.** 시안은 '김영수 어르신'을 넣었지만
 * `docs/11` §3.2가 반대편에 있고, 시안이 틀린 것으로 정리됐습니다 (README §4 C4).
 *
 * 간병사가 알아야 하는 것은 어디서 무엇을 하는가입니다. 필드를 추가할 때
 * "이게 없으면 일을 못 하는가"를 먼저 물어보세요.
 */
export class CaregiverAssignmentDto {
  @Scope('caregiver', 'admin') assignmentId: string;
  @Scope('caregiver', 'admin') status: string;
  @Scope('caregiver', 'admin') hospitalName: string | null;
  /** 환자 식별은 병실까지입니다. 실명 대신 여기를 씁니다. */
  @Scope('caregiver', 'admin') ward: string | null;
  @Scope('caregiver', 'admin') shiftPatternCode: string | null;
  @Scope('caregiver', 'admin') shiftStartTime: string | null;
  @Scope('caregiver', 'admin') shiftEndTime: string | null;
  @Scope('caregiver', 'admin') startAt: Date;
  @Scope('caregiver', 'admin') endAt: Date | null;
  /** 필요한 지원. 진단명 대신 이것으로 치환합니다. */
  @Scope('caregiver', 'admin') supportItems: string[] | null;
  @Scope('caregiver', 'admin') mobilityLevel: string | null;
  @Scope('caregiver', 'admin') cautions: string | null;
  /**
   * 업무범위 경고. 감지 이력이 있는 요청이면 간병사도 알아야 합니다 —
   * 현장에서 같은 요구를 받을 수 있고, 그때 거절할 근거가 됩니다.
   */
  @Scope('caregiver', 'admin') restrictedFlags: string[] | null;
}

/**
 * 근무 기록 한 줄.
 *
 * 보호자도 봅니다 (SCR-306) — "잘 있나 확인"이 가장 많은 행동이고, 시작·종료
 * 기록만 실시간으로 보여줘도 문의가 크게 줍니다.
 *
 * 다만 **서술형 메모는 보호자에게 나가지 않습니다.** 환자 상태를 서술로 남기면
 * 의료기록과 혼동되고, 간병사가 의료적 판단을 적는 경로가 됩니다 (SCR-306 notes).
 * 보호자에게는 정형 항목(logType · itemCode · 시각)만 갑니다.
 */
export class ServiceLogDto {
  @ScopeOwner() ownerUserId: string;

  @Scope('self', 'caregiver', 'admin') id: string;
  @Scope('self', 'caregiver', 'admin') logType: string;
  @Scope('self', 'caregiver', 'admin') itemCode: string | null;
  @Scope('self', 'caregiver', 'admin') occurredAt: Date;
  @Scope('self', 'caregiver', 'admin') checkMethod: string | null;
  /** 정정됐는가. 지우지 않으므로 표시로 구분합니다. */
  @Scope('self', 'caregiver', 'admin') corrected: boolean;
  @Scope('self', 'caregiver', 'admin') correctionOf: string | null;

  /** 서술형은 기록자와 운영자만. 보호자에게는 나가지 않습니다. */
  @Scope('caregiver', 'admin') memo: string | null;
  /** GPS 좌표는 운영자만. 위치는 그 자체로 민감정보입니다. */
  @Scope('admin') geoPoint: unknown | null;
  @Scope('admin') createdBy: string | null;
}
