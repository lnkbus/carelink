import { DomainError } from '../../../core/errors/domain-error';
import type {
  ComplianceCheck, DocumentSpec, EngagementContext, EngagementStrategy, PayoutLine, TaxTreatment, WorkRecord,
} from './engagement.strategy';

/**
 * 직접고용. CARELINK가 사용자(使用者)가 되어 근로계약을 맺는다.
 *
 * 급여 계산 로직은 **구현하지 않는다.** docs/12 §3의 U1·U2가 막고 있다:
 *   U1 기관 현장 배치가 도급인가 파견인가 — 지휘·명령권 설계
 *   U2 해당 직군의 파견 허용 여부 / 근로자공급사업 허가 필요 여부
 *
 * 여기에 U5(24시간 간병의 근로시간 규정 적용 방식)까지 걸린다.
 * 지금 임의로 가정해 구현하면 나중에 전면 재작업이 발생하고, 그 사이에 계산된
 * 급여는 전부 다시 정산해야 한다. 인터페이스와 스키마까지만 만들고 대기한다
 * (CLAUDE.md §6-8 · docs/04 §8).
 */
export class DirectEmploymentStrategy implements EngagementStrategy {
  readonly model = 'DIRECT_EMPLOYMENT' as const;

  requiredContractDocuments(): DocumentSpec[] {
    return [
      { code: 'EMPLOYMENT_CONTRACT', labelKey: 'contract.doc.employmentContract', mandatory: true },
      { code: 'WAGE_STATEMENT_CONSENT', labelKey: 'contract.doc.wageStatementConsent', mandatory: true },
      { code: 'SOCIAL_INSURANCE_ENROLMENT', labelKey: 'contract.doc.socialInsurance', mandatory: true },
      { code: 'WORKING_HOURS_AGREEMENT', labelKey: 'contract.doc.workingHours', mandatory: true },
    ];
  }

  complianceChecks(): ComplianceCheck[] {
    return [
      // 이 둘이 U1·U2 그 자체다. 사람이 판정한 결과를 기록하는 항목이다.
      { code: 'DISPATCH_LAW_REVIEW', labelKey: 'compliance.dispatchLawReview', blocking: true },
      { code: 'WORKING_HOURS', labelKey: 'compliance.workingHours', blocking: true },
      { code: 'SOCIAL_INSURANCE', labelKey: 'compliance.socialInsurance', blocking: true },
      { code: 'VISA_ELIGIBILITY', labelKey: 'compliance.visaEligibility', blocking: true },
      { code: 'CONTRACT_SIGNED', labelKey: 'compliance.contractSigned', blocking: true },
    ];
  }

  calculatePayout(_records: WorkRecord[], _ctx: EngagementContext): PayoutLine[] {
    throw new DomainError('ENGAGEMENT_PAYOUT_UNAVAILABLE', {
      model: this.model,
      blockedBy: ['U1: 도급/파견 판정', 'U2: 파견 허용 여부·공급사업 허가', 'U5: 근로시간 규정 적용 방식'],
      reference: 'docs/12 §3 · docs/04 §8 · CLAUDE.md §6-8',
    });
  }

  taxTreatment(): TaxTreatment { return 'WAGE_INCOME'; }
  revenueRecognition(): 'GROSS' | 'NET' { return 'GROSS'; }
}
