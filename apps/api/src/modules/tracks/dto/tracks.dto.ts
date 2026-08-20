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
