import type {
  ComplianceCheck, DocumentSpec, EngagementContext, EngagementStrategy, PayoutLine, TaxTreatment, WorkRecord,
} from './engagement.strategy';

/**
 * 순수 중개. 기관과 인력이 직접 계약하고 CARELINK는 수수료만 받는다.
 *
 * 인력 지급(payout)이 없다 — 돈이 기관에서 인력으로 직접 가기 때문이다.
 * 그래서 calculatePayout은 빈 배열이 정답이고, 이것이 세 모델을 같은
 * 인터페이스로 묶을 수 있는 이유다.
 *
 * 유료직업소개사업 등록이 필요하다 (docs/11 §6).
 */
export class BrokerageStrategy implements EngagementStrategy {
  readonly model = 'BROKERAGE' as const;

  requiredContractDocuments(): DocumentSpec[] {
    return [
      { code: 'PLACEMENT_AGREEMENT', labelKey: 'contract.doc.placementAgreement', mandatory: true },
      { code: 'FEE_SCHEDULE', labelKey: 'contract.doc.feeSchedule', mandatory: true },
    ];
  }

  complianceChecks(): ComplianceCheck[] {
    return [
      { code: 'VISA_ELIGIBILITY', labelKey: 'compliance.visaEligibility', blocking: true },
      { code: 'CONTRACT_SIGNED', labelKey: 'compliance.contractSigned', blocking: true },
    ];
  }

  /** 중개는 인력에게 지급하지 않는다. 기관이 직접 지급한다. */
  calculatePayout(_records: WorkRecord[], _ctx: EngagementContext): PayoutLine[] {
    return [];
  }

  taxTreatment(): TaxTreatment { return 'NONE'; }
  /** 수수료만 인식한다. 총액이 아니다. */
  revenueRecognition(): 'GROSS' | 'NET' { return 'NET'; }
}
