import { DISPATCH_LIMIT_DAYS, DISPATCH_WARN_DAYS } from './dispatch.limit';

/**
 * 파견 기간 제한 (파견법 §6) — 2026-08-21 U1·U2 확정으로 생긴 의무.
 *
 * 이 값을 늘리면 불법이 됩니다. 상수인 이유이고, 테스트로 못 박는 이유입니다.
 */
describe('파견 2년 제한', () => {
  it('한도는 730일이다 — 운영자가 조정할 수 없는 법정 기간', () => {
    expect(DISPATCH_LIMIT_DAYS).toBe(730);
  });

  it('경고는 2단계다 — 대체 인력 확보에 시간이 걸린다', () => {
    expect(DISPATCH_WARN_DAYS).toEqual([90, 30]);
    expect(DISPATCH_WARN_DAYS[0]).toBeGreaterThan(DISPATCH_WARN_DAYS[1]);
  });

  it('경고 시점이 한도보다 충분히 앞선다', () => {
    for (const days of DISPATCH_WARN_DAYS) {
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThan(DISPATCH_LIMIT_DAYS);
    }
  });
});
