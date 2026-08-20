import { StateMachine } from '../../../core/state/state-machine';

/**
 * 체류자격 확보 절차. 커리어 여정과 별개의 축이다 (S3 확정).
 *
 * 두 축을 나눈 이유는 순서가 서로 모순되기 때문이다. 커리어 여정에서 계약(PLACED)은
 * 매칭·면접을 거친 8번째지만, 여기서는 고용계약이 첫 단계다 — E-7-2 심사가
 * 고용주를 전제로 하므로 계약 없이는 신청 자체가 되지 않는다.
 *
 * 모든 후보자에게 있는 축이 아니다. 시작 조건은 visa-process.policy.ts 참조.
 */
export type VisaProcessStep =
  | 'CONTRACT_SIGNED'
  | 'DOCUMENT_REVIEW'
  | 'APPLICATION_SUBMITTED'
  | 'APPROVED'
  | 'ENTERED'
  | 'REJECTED'
  | 'WITHDRAWN';

export const visaProcessMachine = new StateMachine<VisaProcessStep>(
  'talent.visaProcess',
  {
    CONTRACT_SIGNED: ['DOCUMENT_REVIEW', 'WITHDRAWN'],
    // 서류 보완 요구가 잦다. 접수 전으로 되돌아오는 경로를 열어 둔다.
    DOCUMENT_REVIEW: ['APPLICATION_SUBMITTED', 'WITHDRAWN'],
    APPLICATION_SUBMITTED: ['APPROVED', 'REJECTED', 'DOCUMENT_REVIEW', 'WITHDRAWN'],
    // 국내 자격 변경(D-10 → E-7-2)은 APPROVED가 종착점이다. 입국이 없다.
    // 해외 신규 발급 건만 ENTERED로 이어진다.
    APPROVED: ['ENTERED'],
    ENTERED: [],
    // 불허 후 재신청은 새 절차다. 같은 행을 되살리면 시도 횟수와 리드타임이 뭉갠다.
    REJECTED: [],
    WITHDRAWN: [],
  },
  'CONTRACT_SIGNED',
);

/** 더 진행할 것이 없는 상태. 국내 변경 건은 APPROVED에서 끝난다. */
export function isVisaProcessComplete(step: VisaProcessStep, requiresEntry: boolean): boolean {
  if (step === 'ENTERED') return true;
  if (step === 'APPROVED') return !requiresEntry;
  return false;
}
