import { DomainError } from '../../../core/errors/domain-error';
import {
  assignmentMachine, careRequestMachine, CARE_ASSIGNMENT_SLA_HOURS,
} from './care.state';

describe('careRequestMachine — 업무범위 감지는 거절이 아니라 검토 트리거', () => {
  it('제출 시 스캔에 걸리면 OPS_REVIEW로 빠진다', () => {
    expect(careRequestMachine.can('SUBMITTED', 'OPS_REVIEW')).toBe(true);
  });

  it('OPS_REVIEW에서 매칭으로 돌아올 수 있다 — 자동 거절이 아니다', () => {
    // 운영자가 보호자에게 설명하고 요청을 고쳐 다시 보냅니다.
    // 여기가 막혀 있으면 감지가 사실상 거절이 되고, 그러면 표현만 바꿔 우회합니다.
    expect(careRequestMachine.can('OPS_REVIEW', 'MATCHING')).toBe(true);
  });

  it('ISSUE에서도 되돌아올 수 있다 — 막힌 건을 푸는 것이 운영자의 일', () => {
    expect(careRequestMachine.can('ISSUE', 'MATCHING')).toBe(true);
    expect(careRequestMachine.can('ISSUE', 'ASSIGNED')).toBe(true);
  });

  it('간병사가 거절하면 다시 매칭으로 — 보호자가 다른 사람을 고를 수 있어야 한다', () => {
    expect(careRequestMachine.can('OFFER_SENT', 'MATCHING')).toBe(true);
  });

  it('완료·취소는 종료 상태다', () => {
    expect(careRequestMachine.next('COMPLETED')).toEqual([]);
    expect(careRequestMachine.next('CANCELLED')).toEqual([]);
  });

  it('제출을 건너뛰고 바로 배정할 수 없다', () => {
    expect(() => careRequestMachine.assert('DRAFT', 'ASSIGNED')).toThrow(DomainError);
  });
});

describe('assignmentMachine — 확정은 3단계다 (§6-4)', () => {
  it('제안 → 수락 → 운영자 확인 순서를 강제한다', () => {
    expect(assignmentMachine.can('OFFERED', 'ACCEPTED')).toBe(true);
    expect(assignmentMachine.can('ACCEPTED', 'ASSIGNED')).toBe(true);
  });

  it('수락만으로 근무가 시작되지 않는다', () => {
    // 즉시 자동 확정은 노쇼와 조건 불일치를 그대로 통과시킵니다.
    // 자동화는 취소율이 안정된 뒤에 엽니다.
    expect(assignmentMachine.can('ACCEPTED', 'IN_SERVICE')).toBe(false);
    expect(() => assignmentMachine.assert('ACCEPTED', 'IN_SERVICE')).toThrow(DomainError);
  });

  it('제안 상태에서 바로 확정할 수 없다 — 간병사 수락이 빠지면 노쇼가 난다', () => {
    expect(assignmentMachine.can('OFFERED', 'ASSIGNED')).toBe(false);
  });

  it('거절은 종료 상태다 — 같은 제안을 되살리지 않는다', () => {
    expect(assignmentMachine.next('DECLINED')).toEqual([]);
  });

  it('분쟁은 되돌아가지 않는다 — service_logs로 판정한다', () => {
    expect(assignmentMachine.next('DISPUTED')).toEqual([]);
  });
});

describe('배정 SLA', () => {
  it('4시간이다 — 보호자는 대개 입원 당일에 신청한다', () => {
    expect(CARE_ASSIGNMENT_SLA_HOURS).toBe(4);
  });
});
