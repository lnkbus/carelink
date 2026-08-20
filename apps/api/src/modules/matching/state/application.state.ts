import { StateMachine } from '../../../core/state/state-machine';

/** applications.status — docs/02 §6.4. SCR-109의 4단계 스텝 바. */
export type ApplicationStatus =
  | 'APPLIED' | 'UNDER_REVIEW' | 'INTERVIEW_REQUESTED' | 'INTERVIEW_DONE'
  | 'OFFERED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

export const applicationMachine = new StateMachine<ApplicationStatus>(
  'matching.application',
  {
    APPLIED: ['UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
    UNDER_REVIEW: ['INTERVIEW_REQUESTED', 'REJECTED', 'WITHDRAWN'],
    INTERVIEW_REQUESTED: ['INTERVIEW_DONE', 'REJECTED', 'WITHDRAWN'],
    INTERVIEW_DONE: ['OFFERED', 'REJECTED', 'WITHDRAWN'],
    OFFERED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
    ACCEPTED: [],
    REJECTED: [],
    WITHDRAWN: [],
  },
  'APPLIED',
);

/**
 * 불합격에는 사유가 필수다. SCR-109의 "불합격은 사유 필수".
 *
 * 사유 없는 불합격 통보가 이탈의 직접 원인이고, 무엇을 보완해야 하는지
 * 알려주지 않으면 다음 지원도 같은 이유로 떨어진다.
 */
export const STATUSES_REQUIRING_NOTE: readonly ApplicationStatus[] = ['REJECTED'];

/** 후보자가 스스로 할 수 있는 전이. 나머지는 기관·운영자가 움직인다. */
export const CANDIDATE_DRIVEN: readonly ApplicationStatus[] = ['WITHDRAWN', 'ACCEPTED'];
