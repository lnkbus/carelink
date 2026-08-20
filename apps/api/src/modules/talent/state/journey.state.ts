import { StateMachine } from '../../../core/state/state-machine';

/**
 * 커리어 여정. docs/02 §6.1 · SCREENS SCR-102 · 스키마 journey_step ENUM — 셋이 일치한다.
 *
 * 이 축은 "국내에서 취업 준비 → 매칭 → 배치"를 다룬다.
 * 체류자격 확보 절차는 순서도 의미도 달라 별도 축(visaProcessMachine)으로 뺐다.
 */
export type JourneyStep =
  | 'APPLIED'
  | 'PROFILE_REGISTERED'
  | 'DOC_REVIEW'
  | 'TRAINING'
  | 'READY'
  | 'MATCHED'
  | 'INTERVIEW'
  | 'PLACED'
  | 'ACTIVE';

export const journeyMachine = new StateMachine<JourneyStep>(
  'talent.journey',
  {
    APPLIED: ['PROFILE_REGISTERED'],
    PROFILE_REGISTERED: ['DOC_REVIEW'],
    // 서류가 반려되면 다시 제출해야 하므로 제자리 재진입을 허용한다.
    DOC_REVIEW: ['TRAINING', 'PROFILE_REGISTERED'],
    TRAINING: ['READY', 'DOC_REVIEW'],
    // READY에서 매칭이 나가고, 서류·클리어런스가 만료되면 뒤로 돌아온다.
    READY: ['MATCHED', 'DOC_REVIEW', 'TRAINING'],
    // 매칭이 깨지면 READY로 복귀한다. 이 왕복이 재배치의 실체다.
    MATCHED: ['INTERVIEW', 'READY'],
    INTERVIEW: ['PLACED', 'READY'],
    PLACED: ['ACTIVE', 'READY'],
    // 배치 종료 후 재배치 대기로 돌아간다 — 관계가 끊기지 않는 것이 이 사업의 전제다.
    ACTIVE: ['READY'],
  },
  'APPLIED',
);

/**
 * SCR-101의 5점 스테퍼용 그룹핑.
 *
 * 화면은 9단계를 다 보여주지 않는다. 적재는 9단계로 하되 표시만 접는다 —
 * 표시 형식 때문에 적재 어휘를 줄이면 matching 모듈이 MATCHED·INTERVIEW를
 * 여정에 기록할 곳을 잃는다.
 */
export const JOURNEY_DISPLAY_GROUPS = [
  { key: 'REGISTER', labelKey: 'journey.group.register', steps: ['APPLIED', 'PROFILE_REGISTERED'] },
  { key: 'VERIFY', labelKey: 'journey.group.verify', steps: ['DOC_REVIEW'] },
  { key: 'TRAIN', labelKey: 'journey.group.train', steps: ['TRAINING', 'READY'] },
  { key: 'MATCH', labelKey: 'journey.group.match', steps: ['MATCHED', 'INTERVIEW'] },
  { key: 'WORK', labelKey: 'journey.group.work', steps: ['PLACED', 'ACTIVE'] },
] as const satisfies readonly { key: string; labelKey: string; steps: readonly JourneyStep[] }[];

export function displayGroupOf(step: JourneyStep): string {
  const group = JOURNEY_DISPLAY_GROUPS.find((g) => (g.steps as readonly string[]).includes(step));
  return group?.key ?? JOURNEY_DISPLAY_GROUPS[0].key;
}

/** 현재 단계가 5개 그룹 중 몇 번째인지 (1-based). SCR-101의 "3 / 5". */
export function displayProgress(step: JourneyStep): { current: number; total: number } {
  const key = displayGroupOf(step);
  return {
    current: JOURNEY_DISPLAY_GROUPS.findIndex((g) => g.key === key) + 1,
    total: JOURNEY_DISPLAY_GROUPS.length,
  };
}
