import { StateMachine } from '../../../core/state/state-machine';

/** jobs.status — docs/02 §6.3. SCR-202의 상태 칩. */
export type JobStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'FILLED' | 'CLOSED' | 'EXPIRED';

export const jobMachine = new StateMachine<JobStatus>(
  'matching.job',
  {
    DRAFT: ['OPEN', 'CLOSED'],
    OPEN: ['PAUSED', 'FILLED', 'CLOSED', 'EXPIRED'],
    PAUSED: ['OPEN', 'CLOSED'],
    // 충원 후에도 이탈이 생기면 다시 연다. 새 공고를 만들면 지원 이력이 끊긴다.
    FILLED: ['OPEN', 'CLOSED'],
    EXPIRED: ['OPEN', 'CLOSED'],
    CLOSED: [],
  },
  'DRAFT',
);

/** 매칭·지원을 받을 수 있는 상태인가. */
export function isJobOpen(status: JobStatus): boolean {
  return status === 'OPEN';
}
