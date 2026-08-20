import { StateMachine } from '../../../core/state/state-machine';

/**
 * organizations.verification_status — 스키마 verification_status ENUM.
 *
 * 이 상태가 후보자 개인정보 접근의 게이트다 (CLAUDE.md §6-6).
 * VERIFIED가 아니면 기관은 통계만 보고 후보자 카드는 마스킹된다 (SCR-201 notes).
 */
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export const organizationVerificationMachine = new StateMachine<VerificationStatus>(
  'org.verification',
  {
    PENDING: ['VERIFIED', 'REJECTED'],
    // 사건이 누적된 기관은 신규 배정을 정지시킨다 (SCR-503).
    VERIFIED: ['SUSPENDED', 'REJECTED'],
    // 반려된 기관은 서류를 보완해 재심사에 들어간다.
    REJECTED: ['PENDING'],
    SUSPENDED: ['VERIFIED', 'REJECTED'],
  },
  'PENDING',
);

/**
 * E-7-2 취업처 적격성. organizations.e7_sponsor_status.
 *
 * ELIGIBLE이 아닌 시설에 외국인을 배치하면 체류자격 범위를 벗어난다
 * (CLAUDE.md §6-17 · docs/08 §5.1). 학생을 모으기 전에 시설부터 확보해야 한다.
 */
export type E7SponsorStatus = 'NOT_REVIEWED' | 'ELIGIBLE' | 'INELIGIBLE' | 'CONDITIONAL';

export const e7SponsorMachine = new StateMachine<E7SponsorStatus>(
  'org.e7Sponsor',
  {
    NOT_REVIEWED: ['ELIGIBLE', 'INELIGIBLE', 'CONDITIONAL'],
    // 재검토는 언제든 가능하다. 시설 요건(내국인 근로자 수 등)이 변하기 때문.
    ELIGIBLE: ['INELIGIBLE', 'CONDITIONAL', 'NOT_REVIEWED'],
    CONDITIONAL: ['ELIGIBLE', 'INELIGIBLE', 'NOT_REVIEWED'],
    INELIGIBLE: ['NOT_REVIEWED', 'CONDITIONAL'],
  },
  'NOT_REVIEWED',
);

/** E-7-2 대상 인력을 배치할 수 있는 상태인가. CONDITIONAL은 운영자 확인이 남아 있다. */
export function canSponsorE7(status: E7SponsorStatus): boolean {
  return status === 'ELIGIBLE';
}
