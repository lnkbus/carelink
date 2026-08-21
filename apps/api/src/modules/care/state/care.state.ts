import { StateMachine } from '../../../core/state/state-machine';

/** care_requests.status — SCR-303·304·505 */
export type CareRequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'MATCHING' | 'OFFER_SENT' | 'ASSIGNED'
  | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED' | 'OPS_REVIEW' | 'ISSUE';

/**
 * 간병 요청 상태.
 *
 * `OPS_REVIEW`는 업무범위 키워드가 감지됐을 때 들어갑니다. **거절이 아닙니다** —
 * 운영자가 보호자에게 "그건 의료행위라 간병사가 할 수 없습니다"를 설명하고,
 * 요청을 고쳐 다시 매칭으로 보냅니다. 자동 거절하면 표현만 바꿔 우회하고,
 * 그러면 같은 요구가 감지되지 않은 채 간병사에게 전달됩니다 (§6-15).
 *
 * `ISSUE`는 SLA 초과·사고입니다. 여기서도 되돌아올 수 있어야 합니다 —
 * 막힌 건을 풀어서 다시 진행시키는 것이 운영자의 일입니다.
 */
export const careRequestMachine = new StateMachine<CareRequestStatus>(
  'care.request',
  {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    // 제출 즉시 매칭으로 가거나, 스캔에 걸리면 운영자 검토로 빠집니다.
    SUBMITTED: ['MATCHING', 'OPS_REVIEW', 'CANCELLED'],
    OPS_REVIEW: ['MATCHING', 'CANCELLED'],
    MATCHING: ['OFFER_SENT', 'OPS_REVIEW', 'ISSUE', 'CANCELLED'],
    // 간병사가 거절하면 다시 매칭으로 돌아갑니다.
    OFFER_SENT: ['ASSIGNED', 'MATCHING', 'ISSUE', 'CANCELLED'],
    ASSIGNED: ['IN_SERVICE', 'ISSUE', 'CANCELLED'],
    IN_SERVICE: ['COMPLETED', 'ISSUE'],
    // 사고는 어느 단계에서든 풀려서 원래 흐름으로 돌아갈 수 있어야 합니다.
    ISSUE: ['MATCHING', 'ASSIGNED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  },
  'DRAFT',
);

/** care_assignments.status */
export type AssignmentStatus =
  | 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'ASSIGNED'
  | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

/**
 * 배정 상태 — **3단계 확정** (§6-4 · SCR-304 notes).
 *
 *   OFFERED   보호자가 고른 간병사에게 제안이 갔다
 *   ACCEPTED  간병사가 수락했다        ← 아직 확정이 아니다
 *   ASSIGNED  운영자가 확인했다        ← 여기서 확정
 *
 * **ACCEPTED에서 바로 IN_SERVICE로 가는 전이를 만들지 마세요.** 즉시 자동 확정은
 * 노쇼와 조건 불일치를 그대로 통과시킵니다. 자동화는 취소율이 안정된 뒤에 엽니다.
 */
export const assignmentMachine = new StateMachine<AssignmentStatus>(
  'care.assignment',
  {
    OFFERED: ['ACCEPTED', 'DECLINED', 'CANCELLED'],
    // 수락 ≠ 확정. 운영자 확인이 남아 있습니다.
    ACCEPTED: ['ASSIGNED', 'CANCELLED'],
    DECLINED: [],
    ASSIGNED: ['IN_SERVICE', 'CANCELLED'],
    IN_SERVICE: ['COMPLETED', 'DISPUTED'],
    COMPLETED: ['DISPUTED'],
    // 분쟁은 service_logs를 근거로 판정합니다. 되돌아가지 않습니다.
    DISPUTED: [],
    CANCELLED: [],
  },
  'OFFERED',
);

/**
 * SLA — 요청 후 4시간 안에 배정돼야 합니다 (CLAUDE.md §7).
 *
 * 보호자는 대개 입원 당일에 신청합니다. 밤새 기다리게 하면 다른 경로를 찾고,
 * 한번 떠난 보호자는 돌아오지 않습니다.
 */
export const CARE_ASSIGNMENT_SLA_HOURS = 4;
