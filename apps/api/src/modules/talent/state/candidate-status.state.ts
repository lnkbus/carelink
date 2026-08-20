import { StateMachine } from '../../../core/state/state-machine';

/** candidates.status — 스키마 candidate_status ENUM. SCR-502의 상태 칩. */
export type CandidateStatus =
  | 'DRAFT' | 'DOC_REVIEW' | 'TRAINING' | 'READY'
  | 'MATCHED' | 'PLACED' | 'INACTIVE' | 'SUSPENDED';

export const candidateStatusMachine = new StateMachine<CandidateStatus>(
  'talent.candidateStatus',
  {
    DRAFT: ['DOC_REVIEW', 'INACTIVE'],
    DOC_REVIEW: ['TRAINING', 'READY', 'DRAFT', 'INACTIVE', 'SUSPENDED'],
    TRAINING: ['READY', 'DOC_REVIEW', 'INACTIVE', 'SUSPENDED'],
    READY: ['MATCHED', 'DOC_REVIEW', 'TRAINING', 'INACTIVE', 'SUSPENDED'],
    MATCHED: ['PLACED', 'READY', 'INACTIVE', 'SUSPENDED'],
    PLACED: ['READY', 'INACTIVE', 'SUSPENDED'],
    INACTIVE: ['READY', 'DRAFT'],
    // 정지는 운영자가 해제해야만 풀린다. 본인 조작으로 빠져나갈 수 없다.
    SUSPENDED: ['READY', 'INACTIVE'],
  },
  'DRAFT',
);
