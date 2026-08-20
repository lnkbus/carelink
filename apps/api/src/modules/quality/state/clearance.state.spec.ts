import { clearanceMachine, isCleared, REQUIRED_CLEARANCES, CLEARANCE_VALIDITY_MONTHS, FOREIGN_ONLY_CLEARANCES } from './clearance.state';

describe('clearance — 배치 전 게이트', () => {
  it('필수 항목은 정확히 6개다 (§5.11)', () => {
    expect(REQUIRED_CLEARANCES).toHaveLength(6);
    expect([...REQUIRED_CLEARANCES].sort()).toEqual([
      'CRIMINAL_RECORD_CLEAR', 'HEALTH_CHECK', 'IDENTITY_VERIFIED',
      'MANDATORY_TRAINING', 'SCOPE_TRAINING', 'VISA_ELIGIBLE',
    ]);
  });

  it('유효기간은 범죄경력 2년, 건강진단 1년이다', () => {
    expect(CLEARANCE_VALIDITY_MONTHS.CRIMINAL_RECORD_CLEAR).toBe(24);
    expect(CLEARANCE_VALIDITY_MONTHS.HEALTH_CHECK).toBe(12);
  });

  it('N_A는 통과로 친다 — 내국인의 체류자격 항목', () => {
    // N_A를 미완으로 보면 내국인이 영원히 배치되지 않는다.
    expect(isCleared('N_A')).toBe(true);
    expect(FOREIGN_ONLY_CLEARANCES).toContain('VISA_ELIGIBLE');
  });

  it('PENDING·FAIL·EXPIRED는 통과가 아니다', () => {
    for (const r of ['PENDING', 'FAIL', 'EXPIRED'] as const) expect(isCleared(r)).toBe(false);
  });

  it('만료된 항목은 재검사를 거쳐야 다시 통과한다', () => {
    expect(clearanceMachine.can('EXPIRED', 'PENDING')).toBe(true);
    // 만료에서 바로 PASS로 되돌릴 수 없다 — 검사를 다시 해야 한다.
    expect(clearanceMachine.can('EXPIRED', 'PASS')).toBe(false);
  });
});
