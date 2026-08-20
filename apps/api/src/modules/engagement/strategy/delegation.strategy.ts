import type {
  ComplianceCheck, DocumentSpec, EngagementContext, EngagementStrategy, PayoutLine, TaxTreatment, WorkRecord,
} from './engagement.strategy';

/**
 * 위탁·용역. 인력과 용역 계약을 맺고 용역대가를 지급한다.
 *
 * 보험 채널이 여기 해당한다 — 단가 천장이 고정돼 직접고용 시 마진이 소멸하기
 * 때문이다 (docs/10 §2.1). 사업소득 3.3% 원천징수.
 *
 * 계산 로직은 직접고용보다 단순하지만, 실제 단가·수수료율이 확정되기 전이라
 * 여기서도 금액을 만들어내지 않는다. 근무 기록을 라인으로 변환하는 형태만 둔다.
 */
export class DelegationStrategy implements EngagementStrategy {
  readonly model = 'DELEGATION' as const;

  requiredContractDocuments(): DocumentSpec[] {
    return [
      { code: 'SERVICE_AGREEMENT', labelKey: 'contract.doc.serviceAgreement', mandatory: true },
      { code: 'TAX_WITHHOLDING_CONSENT', labelKey: 'contract.doc.taxWithholding', mandatory: true },
    ];
  }

  complianceChecks(): ComplianceCheck[] {
    return [
      // 위탁이어도 실질이 파견이면 같은 문제가 생긴다. 판정은 여전히 필요하다.
      { code: 'DISPATCH_LAW_REVIEW', labelKey: 'compliance.dispatchLawReview', blocking: true },
      { code: 'VISA_ELIGIBILITY', labelKey: 'compliance.visaEligibility', blocking: true },
      { code: 'CONTRACT_SIGNED', labelKey: 'compliance.contractSigned', blocking: true },
    ];
  }

  /**
   * 용역대가 라인. 단가는 계약(employment_contracts.wage_amount)에서 오고,
   * 원천징수 3.3%는 정산 시점에 적용한다 — 여기서는 근무 사실만 라인으로 만든다.
   */
  calculatePayout(records: WorkRecord[], ctx: EngagementContext): PayoutLine[] {
    return records.map((r) => ({
      engagementId: ctx.engagementId,
      lineType: 'SERVICE_FEE',
      // 금액은 정산 모듈이 단가와 곱한다. 여기서 임의 단가를 넣지 않는다.
      amount: 0,
      quantity: r.regularMinutes + r.nightMinutes + r.overtimeMinutes + r.holidayMinutes,
      note: `work_record:${r.id}`,
    }));
  }

  taxTreatment(): TaxTreatment { return 'BUSINESS_INCOME'; }
  revenueRecognition(): 'GROSS' | 'NET' { return 'GROSS'; }
}
