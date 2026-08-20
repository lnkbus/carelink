import { Scope } from '../../../core/scope/scope.decorator';

export class IndustryDto {
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') id: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') code: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') labelKo: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') isActive: boolean;
}

export class TrackRequirementDto {
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') kind: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') refCode: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') mandatory: boolean;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') note: string | null;
}

export class TrackDto {
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') id: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') code: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') labelKo: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') labelVi: string | null;
  /** NONE | TRAINING_REQUIRED | NATIONAL_LICENSE */
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') qualificationType: string;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') isActive: boolean;
  @Scope('self', 'admin', 'org', 'org_masked', 'partner') requirements?: TrackRequirementDto[];
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
