import { StateMachine } from '../../../core/state/state-machine';

/** worker_clearances.result — docs/02 §6.8. */
export type ClearanceResult = 'PENDING' | 'PASS' | 'FAIL' | 'EXPIRED' | 'N_A';

export const clearanceMachine = new StateMachine<ClearanceResult>(
  'quality.clearance',
  {
    PENDING: ['PASS', 'FAIL', 'N_A'],
    // 유효기간이 지나면 배치 스케줄러가 EXPIRED로 넘긴다.
    PASS: ['EXPIRED', 'FAIL'],
    // 만료·불합격은 재검사로 되돌아간다. 검사 결과는 사람이 넣는다.
    EXPIRED: ['PENDING'],
    FAIL: ['PENDING'],
    N_A: ['PENDING'],
  },
  'PENDING',
);

/**
 * 배치 전 통과해야 하는 6개 항목 (docs/07 §4 · CLAUDE.md §5.11).
 * 전부 PASS여야 배치 가능하고, 운영자 예외 처리 경로를 만들지 않는다.
 */
export const REQUIRED_CLEARANCES = [
  'IDENTITY_VERIFIED',
  'CRIMINAL_RECORD_CLEAR',
  'HEALTH_CHECK',
  'VISA_ELIGIBLE',
  'MANDATORY_TRAINING',
  'SCOPE_TRAINING',
] as const;

export type ClearanceType = (typeof REQUIRED_CLEARANCES)[number];

/**
 * 유효기간. 범죄경력 2년, 건강진단 1년 (docs/07 §3.1).
 * 만료되면 EXPIRED로 전이하고 신규 배정을 차단한다.
 */
export const CLEARANCE_VALIDITY_MONTHS: Partial<Record<ClearanceType, number>> = {
  CRIMINAL_RECORD_CLEAR: 24,
  HEALTH_CHECK: 12,
};

/**
 * 외국인에게만 해당하는 항목. 내국인은 N_A가 정상이다.
 * N_A를 미완으로 취급하면 내국인이 영원히 배치되지 않는다.
 */
export const FOREIGN_ONLY_CLEARANCES: readonly ClearanceType[] = ['VISA_ELIGIBLE'];

/** 배치 가능한 결과인가. N_A는 '해당 없음'이므로 통과로 친다. */
export function isCleared(result: ClearanceResult): boolean {
  return result === 'PASS' || result === 'N_A';
}
