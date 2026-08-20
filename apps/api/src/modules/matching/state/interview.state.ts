import { StateMachine } from '../../../core/state/state-machine';

/** interviews.status — docs/02 §6. SCR-205. */
export type InterviewStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const interviewMachine = new StateMachine<InterviewStatus>(
  'matching.interview',
  {
    REQUESTED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
    COMPLETED: [],
    CANCELLED: [],
    // NO_SHOW를 취소와 구분하는 이유: 평균 충원 기간과 후보자 신뢰도에 반영해야
    // 공급 품질을 관리할 수 있다 (SCR-205 notes).
    NO_SHOW: [],
  },
  'REQUESTED',
);

/**
 * 후보자가 면접 요청을 수락한 상태인가.
 *
 * 이 값이 참이어야 기관에 실명·연락처가 열린다 (docs/02 §5.2).
 * 이 게이트가 뚫리면 플랫폼을 우회한 직거래가 발생한다.
 */
export function unlocksCandidatePii(status: InterviewStatus): boolean {
  return status === 'CONFIRMED' || status === 'COMPLETED' || status === 'NO_SHOW';
}
