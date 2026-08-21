import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
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
