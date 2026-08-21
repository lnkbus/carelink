import {
  ESCALATION_ROUTE, TICKET_SLA_HOURS, URGENT_TICKET_TYPES,
  isUrgent, ticketMachine, type TicketType,
} from './ticket.state';

const ALL_TYPES: TicketType[] = [
  'SAFETY_INCIDENT', 'SERVICE_QUALITY', 'WORK_HOUR_DISPUTE',
  'PAYMENT', 'HARASSMENT', 'SCOPE_VIOLATION', 'OTHER',
];

describe('사건 상태 (SCR-506)', () => {
  it('에스컬레이션은 되돌아올 수 있다', () => {
    // 내리는 경로가 없으면 운영자가 올리기를 꺼리고, 그러면 4시간 SLA가
    // 있어도 급한 건이 NEW에 남습니다.
    expect(ticketMachine.can('ESCALATED', 'IN_REVIEW')).toBe(true);
  });

  it('종결한 건도 다시 연다 — 새 티켓을 만들면 이력이 끊긴다', () => {
    expect(ticketMachine.can('RESOLVED', 'IN_REVIEW')).toBe(true);
  });

  it('종결에서 곧바로 에스컬레이션으로 건너뛰지 않는다', () => {
    // 다시 열어서 확인한 다음 올립니다. 확인 없이 올라가면 경로 담당자가
    // 무엇이 달라졌는지 알 수 없습니다.
    expect(ticketMachine.can('RESOLVED', 'ESCALATED')).toBe(false);
  });

  it('접수 즉시 종결이 가능하다 — 오신고·중복은 흔하다', () => {
    expect(ticketMachine.can('NEW', 'RESOLVED')).toBe(true);
  });
});

describe('긴급 유형과 SLA', () => {
  it('안전사고·부당대우·업무범위 초과가 긴급이다 (CLAUDE.md §7)', () => {
    expect([...URGENT_TICKET_TYPES].sort()).toEqual(
      ['HARASSMENT', 'SAFETY_INCIDENT', 'SCOPE_VIOLATION'],
    );
  });

  it('SLA는 4시간이다', () => {
    expect(TICKET_SLA_HOURS).toBe(4);
  });

  it('결제·서비스 품질은 긴급이 아니다 — 전부 긴급이면 아무것도 긴급하지 않다', () => {
    expect(isUrgent('PAYMENT')).toBe(false);
    expect(isUrgent('SERVICE_QUALITY')).toBe(false);
    expect(isUrgent('OTHER')).toBe(false);
  });
});

describe('에스컬레이션 경로', () => {
  it('모든 유형에 경로가 있다 — 빠진 유형은 아무에게도 가지 않는다', () => {
    for (const t of ALL_TYPES) {
      expect(ESCALATION_ROUTE[t]).toBeTruthy();
    }
  });

  it('긴급 세 유형은 서로 다른 담당자에게 간다', () => {
    // 같은 큐에 쌓이면 안전사고가 업무범위 건에 묻힙니다 (SCR-506 notes).
    const routes = URGENT_TICKET_TYPES.map((t) => ESCALATION_ROUTE[t]);
    expect(new Set(routes).size).toBe(URGENT_TICKET_TYPES.length);
  });

  it('부당대우는 일반 CS 경로로 가지 않는다', () => {
    // 신고자가 보복을 우려하는 사안이라 처리자가 제한돼야 합니다.
    expect(ESCALATION_ROUTE.HARASSMENT).not.toBe(ESCALATION_ROUTE.OTHER);
    expect(ESCALATION_ROUTE.HARASSMENT).toBe('COMPLIANCE_LEAD');
  });

  it('업무범위 초과는 임상 담당자에게 간다 — 무면허 의료행위 문제다', () => {
    expect(ESCALATION_ROUTE.SCOPE_VIOLATION).toBe('CLINICAL_LEAD');
  });
});
