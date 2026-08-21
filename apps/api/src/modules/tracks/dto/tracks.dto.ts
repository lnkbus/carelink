import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID,
  Length, Max, Min, ValidateNested,
} from 'class-validator';
import { Scope } from '../../../core/scope/scope.decorator';

export class IndustryDto {
  @Scope('public', 'admin') id: string;
  @Scope('public', 'admin') code: string;
  @Scope('public', 'admin') labelKo: string;
  @Scope('public', 'admin') isActive: boolean;
}

export class TrackRequirementDto {
  @Scope('public', 'admin') kind: string;
  @Scope('public', 'admin') refCode: string;
  @Scope('public', 'admin') mandatory: boolean;
  @Scope('public', 'admin') note: string | null;
}

export class TrackDto {
  @Scope('public', 'admin') id: string;
  @Scope('public', 'admin') code: string;
  @Scope('public', 'admin') labelKo: string;
  @Scope('public', 'admin') labelVi: string | null;
  /** NONE | TRAINING_REQUIRED | NATIONAL_LICENSE */
  @Scope('public', 'admin') qualificationType: string;
  @Scope('public', 'admin') isActive: boolean;
  @Scope('public', 'admin') requirements?: TrackRequirementDto[];
  /**
   * 체류자격 코드 목록은 운영자에게만 나간다.
   * 기관에는 '취업 가능 여부'만 노출한다 (CLAUDE.md §6-12 · docs/11 §1.2).
   */
  @Scope('admin') visaTypes: string[] | null;
}

/** 트랙 × 비자 매트릭스. 원본 매트릭스는 운영자 전용이다. */
export class VisaEligibilityDto {
  @Scope('admin') visaCode: string;
  @Scope('admin') eligibility: string;
  @Scope('admin') targetVisaCode: string | null;
  @Scope('admin') leadTimeMonths: number | null;
  @Scope('admin') note: string | null;
}

const ELIGIBILITY = [
  'ALLOWED', 'REQUIRES_QUALIFICATION', 'REQUIRES_CONVERSION',
  'PENDING_CONFIRMATION', 'NOT_ALLOWED',
] as const;

/**
 * 적격성 판정 입력.
 *
 * 시스템이 판정하지 않고 사람이 확인한 결과를 받습니다 (§6-1 · §6-11).
 * 회색 영역을 경영 판단으로 여는 경우 `isProvisional`을 참으로 두세요 —
 * 뒤집힐 것을 전제로 운영해야 한다는 표시입니다.
 */
export class RecordEligibilityDto {
  @IsIn(ELIGIBILITY) eligibility: (typeof ELIGIBILITY)[number];
  @IsOptional() @IsBoolean() isProvisional?: boolean;
  /** 판정 근거. '1345 문서 회신 2026-09-15' 같은 원문 출처를 남기세요. */
  @IsOptional() @IsString() @Length(1, 500) basis?: string;
}

/**
 * 적격성 변경 영향.
 *
 * 잠정 판정을 운영할 수 있게 하는 유일한 근거입니다 — 뒤집을 때 이미 배치된
 * 인력이 불법 취업 상태가 되므로, 명단이 먼저 나와야 대응이 됩니다.
 */
export class EligibilityImpactDto {
  @Scope('admin') trackId: string;
  @Scope('admin') visaCode: string;
  @Scope('admin') total: number;
  /** 배치 중인 인원. 이 숫자가 0이 아니면 뒤집기 전에 계획이 필요합니다. */
  @Scope('admin') placed: number;
  @Scope('admin') candidates: {
    displayCode: string; status: string;
    engagementId: string | null; organizationName: string | null;
  }[];
}


// ── SCR-507 입력 ────────────────────────────────────────────────────────────
//
// **이 화면이 버티컬 확장의 실행 창구입니다.** 농업·미용을 열 때 개발자가
// 아니라 운영자가 여기서 산업과 트랙을 만듭니다 (SCR-507 notes · §5.8).

const QUALIFICATION_TYPES = ['NONE', 'TRAINING_REQUIRED', 'NATIONAL_LICENSE'] as const;
const REQUIREMENT_KINDS = ['DOCUMENT', 'TRAINING', 'LICENSE', 'HEALTH_CHECK', 'AGE'] as const;

export class CreateIndustryDto {
  /** 코드는 대문자 스네이크. 코드를 바꾸면 기존 참조가 끊기므로 수정 API가 없습니다. */
  @IsString() @Length(2, 32) code: string;
  @IsString() @Length(1, 80) labelKo: string;
  @IsOptional() @IsInt() @Min(0) @Max(999) sortOrder?: number;
}

export class CreateTrackDto {
  @IsUUID() industryId: string;
  @IsString() @Length(2, 64) code: string;
  @IsString() @Length(1, 120) labelKo: string;
  @IsOptional() @IsString() @Length(1, 120) labelVi?: string;
  @IsOptional() @IsString() @Length(1, 120) labelEn?: string;
  @IsIn(QUALIFICATION_TYPES) qualificationType: (typeof QUALIFICATION_TYPES)[number];
  /**
   * 관련 체류자격 코드. **표시·필터용이고 적격성을 판정하지 않습니다** (§6-11).
   * 실제 허용 여부는 `track_visa_eligibility`가 정하고, 회색 영역은
   * `PENDING_CONFIRMATION`으로 두어 사람이 확인합니다.
   */
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) visaTypes?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(999) sortOrder?: number;
}

export class ActiveDto {
  @IsBoolean() isActive: boolean;
}

export class RequirementInputDto {
  @IsIn(REQUIREMENT_KINDS) kind: (typeof REQUIREMENT_KINDS)[number];
  @IsOptional() @IsString() @Length(1, 64) refCode?: string;
  @IsOptional() @IsBoolean() mandatory?: boolean;
  @IsOptional() @IsString() @Length(1, 500) note?: string;
}

export class ReplaceRequirementsDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  @Type(() => RequirementInputDto)
  requirements: RequirementInputDto[];
}

export class WeightInputDto {
  @IsString() @Length(1, 64) ruleCode: string;
  /**
   * 배점. 0~100으로 제한합니다 — 한 룰에 1000점을 주면 나머지 룰이
   * 사실상 무시되고, 그건 룰 기반 매칭을 쓰는 이유를 없앱니다 (§5.6).
   */
  @IsInt() @Min(0) @Max(100) maxPoints: number;
}

export class ReplaceWeightsDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true })
  @Type(() => WeightInputDto)
  weights: WeightInputDto[];
}

export class TrackWeightsDto {
  @Scope('admin') trackId: string;
  @Scope('admin') weights: Record<string, number>;
}
