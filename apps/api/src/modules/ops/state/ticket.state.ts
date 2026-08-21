import { StateMachine } from '../../../core/state/state-machine';

export type TicketStatus = 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'ESCALATED';

export type TicketType =
  | 'SAFETY_INCIDENT' | 'SERVICE_QUALITY' | 'WORK_HOUR_DISPUTE'
  | 'PAYMENT' | 'HARASSMENT' | 'SCOPE_VIOLATION' | 'OTHER';

/**
 * 사건·문의 상태 (SCR-506).
 *
 * `ESCALATED`에서 되돌아올 수 있어야 합니다 — 올렸다가 확인해 보니 일반 건이면
 * 다시 내려야 하고, 내리는 경로가 없으면 에스컬레이션을 꺼리게 됩니다.
 *
 * `RESOLVED`에서도 다시 열립니다. 종결했는데 같은 문제가 반복되면 새 티켓을
 * 만드는 것보다 원 티켓을 여는 편이 이력이 남습니다.
 */
export const ticketMachine = new StateMachine<TicketStatus>(
  'ops.ticket',
  {
    NEW: ['IN_REVIEW', 'ESCALATED', 'RESOLVED'],
    IN_REVIEW: ['RESOLVED', 'ESCALATED'],
    ESCALATED: ['IN_REVIEW', 'RESOLVED'],
    // 종결 후 재발하면 다시 연다. 새 티켓을 만들면 이력이 끊긴다.
    RESOLVED: ['IN_REVIEW'],
  },
  'NEW',
);

/**
 * 4시간 내 1차 대응이 필요한 유형 (CLAUDE.md §7 · docs/03 주석).
 *
 * 세 유형은 성격이 다르지만 공통점이 있습니다 — **늦으면 사업이 끝납니다.**
 *   SAFETY_INCIDENT  환자 안전. 늦으면 사람이 다칩니다
 *   HARASSMENT       외국인 인력 부당대우. 늦으면 인력 공급망이 끊깁니다
 *   SCOPE_VIOLATION  간병사에게 의료행위 요구. 늦으면 무면허 의료행위가 됩니다
 */
export const URGENT_TICKET_TYPES: readonly TicketType[] = [
  'SAFETY_INCIDENT', 'HARASSMENT', 'SCOPE_VIOLATION',
];

export const TICKET_SLA_HOURS = 4;

/**
 * 유형별 에스컬레이션 경로.
 *
 * **경로를 분리하는 것이 요점입니다** (SCR-506 notes). 전부 같은 담당자에게
 * 올리면 안전사고와 결제 문의가 같은 큐에 쌓이고, 급한 것이 묻힙니다.
 *
 * 특히 외국인 인력 부당대우는 일반 CS 경로로 보내면 안 됩니다 — 신고자가
 * 보복을 우려하는 사안이라 처리자가 제한돼야 합니다.
 */
export const ESCALATION_ROUTE: Record<TicketType, string> = {
  SAFETY_INCIDENT: 'SAFETY_LEAD',
  HARASSMENT: 'COMPLIANCE_LEAD',
  SCOPE_VIOLATION: 'CLINICAL_LEAD',
  WORK_HOUR_DISPUTE: 'OPS_LEAD',
  SERVICE_QUALITY: 'OPS_LEAD',
  PAYMENT: 'FINANCE_LEAD',
  OTHER: 'OPS_LEAD',
};

export function isUrgent(type: TicketType): boolean {
  return URGENT_TICKET_TYPES.includes(type);
}
