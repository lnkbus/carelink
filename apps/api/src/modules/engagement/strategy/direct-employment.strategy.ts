import { DomainError } from '../../../core/errors/domain-error';
import type {
  ComplianceCheck, DocumentSpec, EngagementContext, EngagementStrategy, PayoutLine, TaxTreatment, WorkRecord,
} from './engagement.strategy';

/**
 * 직접고용 + 근로자파견. CARELINK가 사용자(使用者)로서 근로계약을 맺고,
 * 파견사업주로서 기관(사용사업주)에 파견한다.
 *
 * ── 2026-08-21 U1·U2 확정 ────────────────────────────────────────────────
 * 노무사 검토 결과 해당 직군은 **파견 허용 업무**이고 근로자파견사업 허가를
 * 보유한다. 따라서 지휘·명령권은 사용사업주에 있고, 도급으로 위장할 필요가 없다.
 *
 * 확정으로 열린 것: 계약 구조, 기관 영업, 현장 지휘 설계.
 * 확정과 함께 **새로 생긴 의무**:
 *   - 파견 기간 2년 제한 (§6) — `dispatch.limit.ts`가 강제한다
 *   - 허가번호 기재 (§7) — 파견 건은 허가번호 없이 만들 수 없다
 *   - 차별적 처우 금지 (§21) — 사용사업주의 동종 근로자 대비
 *
 * ── 여전히 막혀 있는 것 ──────────────────────────────────────────────────
 * **급여 계산은 U5가 막고 있다.** 24시간 간병의 휴게·대기 시간을 근로시간으로
 * 볼지가 정해지지 않았다. 판례는 "사용자의 지휘·감독 아래 있으면 근로시간"으로
 * 보는데, 자는 동안에도 환자 호출에 응해야 하면 그 시간이 근로시간이 된다.
 * 이 판정에 따라 연장·야간 수당이 통째로 달라진다.
 *
 * 지금 임의로 가정해 구현하면 그 사이 계산된 급여를 전부 다시 정산해야 한다.
 * 인터페이스와 스키마까지만 두고 대기한다 (CLAUDE.md §6-8 · docs/12 U5).
 */
export class DirectEmploymentStrategy implements EngagementStrategy {
  readonly model = 'DIRECT_EMPLOYMENT' as const;

  requiredContractDocuments(): DocumentSpec[] {
    return [
      { code: 'EMPLOYMENT_CONTRACT', labelKey: 'contract.doc.employmentContract', mandatory: true },
      { code: 'WAGE_STATEMENT_CONSENT', labelKey: 'contract.doc.wageStatementConsent', mandatory: true },
      { code: 'SOCIAL_INSURANCE_ENROLMENT', labelKey: 'contract.doc.socialInsurance', mandatory: true },
      { code: 'WORKING_HOURS_AGREEMENT', labelKey: 'contract.doc.workingHours', mandatory: true },
      // 파견 확정으로 추가된 서류. 파견법 §20의 법정 기재사항이 들어간다.
      //
      // **교체 절차를 반드시 포함한다.** 2년 한도가 다가오면 인력을 교체하거나
      // 사용사업주가 직접고용해야 하는데, 그 절차가 계약서에 없으면 그때 가서
      // 협상하게 된다. 이미 사람이 현장에 있는 상태의 협상은 불리하다.
      // 최소 기재: 교체 통보 시점(D-90 권장) · 인수인계 기간 · 후임 선정 방식 ·
      //           직접고용 전환을 택할 경우의 절차와 비용 부담.
      { code: 'DISPATCH_CONTRACT', labelKey: 'contract.doc.dispatchContract', mandatory: true },
      { code: 'DISPATCH_REPLACEMENT_PLAN', labelKey: 'contract.doc.dispatchReplacementPlan', mandatory: true },
    ];
  }

  complianceChecks(): ComplianceCheck[] {
    return [
      // U1·U2가 확정된 뒤에도 배치 단위 확인은 남는다. 직군·업무 내용이
      // 실제로 허용 범위 안인지는 배치마다 달라질 수 있다.
      { code: 'DISPATCH_LAW_REVIEW', labelKey: 'compliance.dispatchLawReview', blocking: true },
      // 2년 한도. 서비스가 생성 시점에 막지만, 기관과 합의한 종료 시점을
      // 사람이 확인했다는 기록이 별도로 필요하다.
      { code: 'DISPATCH_PERIOD_LIMIT', labelKey: 'compliance.dispatchPeriodLimit', blocking: true },
      // 교체 절차가 계약서에 들어갔는지. 한도가 닥쳐서야 협상하지 않기 위한 확인이다.
      { code: 'DISPATCH_REPLACEMENT_AGREED', labelKey: 'compliance.dispatchReplacementAgreed', blocking: true },
      // 파견법 §21. 사용사업주의 동종 근로자 대비 차별이 없는지.
      { code: 'EQUAL_TREATMENT', labelKey: 'compliance.equalTreatment', blocking: true },
      { code: 'WORKING_HOURS', labelKey: 'compliance.workingHours', blocking: true },
      { code: 'SOCIAL_INSURANCE', labelKey: 'compliance.socialInsurance', blocking: true },
      { code: 'VISA_ELIGIBILITY', labelKey: 'compliance.visaEligibility', blocking: true },
      { code: 'CONTRACT_SIGNED', labelKey: 'compliance.contractSigned', blocking: true },
    ];
  }

  calculatePayout(_records: WorkRecord[], _ctx: EngagementContext): PayoutLine[] {
    throw new DomainError('ENGAGEMENT_PAYOUT_UNAVAILABLE', {
      model: this.model,
      // U1·U2는 2026-08-21 해소됐다. U5 하나가 남아 있다.
      blockedBy: ['U5: 24시간 간병의 근로시간 규정 적용 방식 (휴게·대기 시간 판정)'],
      resolved: ['U1: 파견으로 확정 (2026-08-21)', 'U2: 파견 허용 업무 · 허가 보유 (2026-08-21)'],
      reference: 'docs/12 §3 · docs/13 §1 D-13 · CLAUDE.md §6-8',
    });
  }

  taxTreatment(): TaxTreatment { return 'WAGE_INCOME'; }
  revenueRecognition(): 'GROSS' | 'NET' { return 'GROSS'; }
}
