import { StateMachine } from '../../../core/state/state-machine';

/** engagements.status — docs/02 §6.6. */
export type EngagementStatus = 'DRAFT' | 'CONTRACT_PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'ENDED';

export const engagementMachine = new StateMachine<EngagementStatus>(
  'engagement.status',
  {
    DRAFT: ['CONTRACT_PENDING', 'TERMINATED'],
    // CONTRACT_PENDING → ACTIVE 전이는 컴플라이언스 체크가 전부 PASS일 때만 허용한다.
    // 상태머신이 아니라 서비스가 그 조건을 강제한다 — 체크 목록이 모델별로 다르기 때문.
    CONTRACT_PENDING: ['ACTIVE', 'TERMINATED'],
    ACTIVE: ['SUSPENDED', 'ENDED', 'TERMINATED'],
    SUSPENDED: ['ACTIVE', 'ENDED', 'TERMINATED'],
    ENDED: [],
    TERMINATED: [],
  },
  'DRAFT',
);

/**
 * 모델 전환은 상태 전이가 아니다 (docs/04 §3.2 · §5.7).
 *
 * 기존 건을 ENDED 처리하고 새 engagement를 만들어 previous_engagement_id로 잇는다.
 * UPDATE로 모델을 바꾸면 과거 정산이 새 모델로 계산된 것처럼 보이게 되고,
 * 그 시점의 계약·세무 처리와 어긋난다.
 */
export const MODEL_IS_IMMUTABLE = true;
