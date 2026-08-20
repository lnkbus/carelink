import { StateMachine } from '../../../core/state/state-machine';

/** cohort_members.stage — docs/02 §6.7. */
export type CohortStage =
  | 'APPLIED' | 'SELECTED' | 'IN_TRAINING' | 'COMPLETED' | 'EXAM_PASSED' | 'PLACED' | 'DROPPED';

export const cohortMemberMachine = new StateMachine<CohortStage>(
  'recruiting.cohortMember',
  {
    APPLIED: ['SELECTED', 'DROPPED'],
    SELECTED: ['IN_TRAINING', 'DROPPED'],
    IN_TRAINING: ['COMPLETED', 'DROPPED'],
    COMPLETED: ['EXAM_PASSED', 'DROPPED'],
    EXAM_PASSED: ['PLACED', 'DROPPED'],
    PLACED: ['DROPPED'],
    // 이탈은 종료 상태다. 재참여는 새 기수로 들어간다 —
    // 같은 행을 되살리면 이탈 시점 통계가 뭉개진다.
    DROPPED: [],
  },
  'APPLIED',
);

/** 퍼널 표시 순서. DROPPED는 단계가 아니라 이탈이므로 뺀다. */
export const FUNNEL_STAGES: readonly CohortStage[] = [
  'APPLIED', 'SELECTED', 'IN_TRAINING', 'COMPLETED', 'EXAM_PASSED', 'PLACED',
];

/** cohorts.status */
export type CohortStatus = 'PLANNED' | 'RECRUITING' | 'IN_TRAINING' | 'EXAM' | 'PLACEMENT' | 'CLOSED';

export const cohortMachine = new StateMachine<CohortStatus>(
  'recruiting.cohort',
  {
    PLANNED: ['RECRUITING', 'CLOSED'],
    RECRUITING: ['IN_TRAINING', 'CLOSED'],
    IN_TRAINING: ['EXAM', 'CLOSED'],
    EXAM: ['PLACEMENT', 'CLOSED'],
    PLACEMENT: ['CLOSED'],
    CLOSED: [],
  },
  'PLANNED',
);
