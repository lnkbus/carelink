import { engagementMachine } from './engagement.state';

describe('engagementMachine — docs/02 §6.6', () => {
  it('계약 대기를 거쳐야 ACTIVE가 된다', () => {
    expect(engagementMachine.can('DRAFT', 'ACTIVE')).toBe(false);
    expect(engagementMachine.can('DRAFT', 'CONTRACT_PENDING')).toBe(true);
    expect(engagementMachine.can('CONTRACT_PENDING', 'ACTIVE')).toBe(true);
  });

  it('종료된 배치는 되살리지 않는다', () => {
    // 모델 전환도 재개가 아니라 새 engagement 생성이다 (§5.7).
    expect(engagementMachine.isTerminal('ENDED')).toBe(true);
    expect(engagementMachine.isTerminal('TERMINATED')).toBe(true);
  });

  it('중단은 재개할 수 있다', () => {
    expect(engagementMachine.can('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(engagementMachine.can('SUSPENDED', 'ACTIVE')).toBe(true);
  });
});
