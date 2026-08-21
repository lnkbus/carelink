import { DomainError } from '../../../core/errors/domain-error';
import { EngagementStrategyFactory } from './engagement-strategy.factory';

describe('EngagementStrategy — 3종 골격 (docs/04 §3.4)', () => {
  const factory = new EngagementStrategyFactory();

  it('세 모델이 모두 등록돼 있다', () => {
    expect(factory.all().map((s) => s.model).sort()).toEqual(['BROKERAGE', 'DELEGATION', 'DIRECT_EMPLOYMENT']);
  });

  it('DirectEmployment의 급여 계산은 구현하지 않는다', () => {
    // U1(도급/파견 판정)·U2(파견 허용 여부)가 막고 있다.
    // 임의로 가정해 구현하면 나중에 전면 재작업이고, 그 사이 계산된 급여는 전부 재정산이다.
    const s = factory.get('DIRECT_EMPLOYMENT');
    expect(() => s.calculatePayout([], { engagementId: 'e1', trackCode: 'X', periodStart: new Date(), periodEnd: new Date() }))
      .toThrow(DomainError);
    try {
      s.calculatePayout([], { engagementId: 'e1', trackCode: 'X', periodStart: new Date(), periodEnd: new Date() });
    } catch (e) {
      const err = e as DomainError;
      expect(err.code).toBe('ENGAGEMENT_PAYOUT_UNAVAILABLE');
      // U1·U2는 2026-08-21 해소됐다 (파견으로 확정). U5 하나가 남아 있다.
      expect(err.details?.blockedBy).toEqual(expect.arrayContaining([expect.stringContaining('U5')]));
      expect(err.details?.resolved).toEqual(
        expect.arrayContaining([expect.stringContaining('U1'), expect.stringContaining('U2')]),
      );
    }
  });

  it('중개는 인력 지급이 없다 — 빈 배열이 정답이다', () => {
    // 돈이 기관에서 인력으로 직접 간다. 이것이 세 모델을 한 인터페이스로 묶을 수 있는 이유다.
    const s = factory.get('BROKERAGE');
    expect(s.calculatePayout([], { engagementId: 'e1', trackCode: 'X', periodStart: new Date(), periodEnd: new Date() })).toEqual([]);
    expect(s.revenueRecognition()).toBe('NET');
    expect(s.taxTreatment()).toBe('NONE');
  });

  it('위탁은 사업소득, 직접고용은 근로소득이다', () => {
    expect(factory.get('DELEGATION').taxTreatment()).toBe('BUSINESS_INCOME');
    expect(factory.get('DIRECT_EMPLOYMENT').taxTreatment()).toBe('WAGE_INCOME');
  });

  it('직접고용만 매출을 총액으로 인식한다... 위탁도 총액이다', () => {
    // 위탁은 용역대가가 CARELINK를 거쳐 가므로 총액, 중개는 수수료만이라 순액이다.
    expect(factory.get('DIRECT_EMPLOYMENT').revenueRecognition()).toBe('GROSS');
    expect(factory.get('DELEGATION').revenueRecognition()).toBe('GROSS');
    expect(factory.get('BROKERAGE').revenueRecognition()).toBe('NET');
  });

  it('도급/파견 판정은 직접고용과 위탁 양쪽의 차단 항목이다', () => {
    // 위탁이어도 실질이 파견이면 같은 문제가 생긴다.
    for (const model of ['DIRECT_EMPLOYMENT', 'DELEGATION'] as const) {
      const codes = factory.get(model).complianceChecks().filter((c) => c.blocking).map((c) => c.code);
      expect(codes).toContain('DISPATCH_LAW_REVIEW');
    }
    // 중개는 CARELINK가 사용자가 아니므로 해당 없다.
    expect(factory.get('BROKERAGE').complianceChecks().map((c) => c.code)).not.toContain('DISPATCH_LAW_REVIEW');
  });

  it('근로시간 규정 확인은 직접고용에만 있다', () => {
    expect(factory.get('DIRECT_EMPLOYMENT').complianceChecks().map((c) => c.code)).toContain('WORKING_HOURS');
    expect(factory.get('BROKERAGE').complianceChecks().map((c) => c.code)).not.toContain('WORKING_HOURS');
  });

  it('세 모델 모두 체류자격과 계약 서명을 차단 항목으로 둔다', () => {
    for (const s of factory.all()) {
      const blocking = s.complianceChecks().filter((c) => c.blocking).map((c) => c.code);
      expect(blocking).toEqual(expect.arrayContaining(['VISA_ELIGIBILITY', 'CONTRACT_SIGNED']));
    }
  });

  it('모르는 모델은 조용히 넘어가지 않는다', () => {
    expect(() => factory.get('UNKNOWN' as never)).toThrow(/구현되지 않은 고용 모델/);
  });
});
