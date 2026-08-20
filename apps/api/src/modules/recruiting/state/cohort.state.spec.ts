import { cohortMemberMachine, FUNNEL_STAGES, type CohortStage } from './cohort.state';

describe('cohortMemberMachine — 이탈 시점 기록이 이 모듈의 존재 이유', () => {
  it('어느 단계에서든 이탈할 수 있다', () => {
    for (const stage of FUNNEL_STAGES) {
      expect(cohortMemberMachine.can(stage, 'DROPPED')).toBe(true);
    }
  });

  it('단계를 건너뛸 수 없다', () => {
    expect(cohortMemberMachine.can('APPLIED', 'IN_TRAINING')).toBe(false);
    expect(cohortMemberMachine.can('SELECTED', 'COMPLETED')).toBe(false);
  });

  it('이탈은 종료 상태다 — 재참여는 새 기수로', () => {
    // 같은 행을 되살리면 "교육 6주차 집중 이탈" 같은 신호가 뭉개진다.
    expect(cohortMemberMachine.isTerminal('DROPPED')).toBe(true);
  });

  it('퍼널은 6단계이고 이탈은 단계가 아니다', () => {
    expect(FUNNEL_STAGES).toHaveLength(6);
    expect(FUNNEL_STAGES).not.toContain('DROPPED');
  });
});

/**
 * 퍼널 누적 계산 회귀 테스트.
 *
 * 이탈자를 현재 stage(DROPPED)로만 세면 앞 단계 인원이 통째로 사라진다.
 * 그러면 이탈이 많은 기수일수록 퍼널이 더 좋아 보이는 역설이 생긴다 —
 * repo.funnel()이 이탈자를 dropped_stage로 환산해 주는 이유다 (§5.13 · SCR-511).
 */
describe('퍼널 누적 — 이탈자는 도달한 단계까지 센다', () => {
  /** RecruitingService.funnel()의 누적 계산부와 동일한 규칙. */
  function cumulative(byStage: Partial<Record<CohortStage, number>>) {
    const out: { stage: CohortStage; count: number; conversionPct: number }[] = [];
    for (let i = 0; i < FUNNEL_STAGES.length; i++) {
      const reached = FUNNEL_STAGES.slice(i).reduce((sum, s) => sum + (byStage[s] ?? 0), 0);
      out.push({ stage: FUNNEL_STAGES[i], count: reached, conversionPct: 0 });
    }
    const base = out[0].count;
    return out.map((r) => ({ ...r, conversionPct: base === 0 ? 0 : Math.round((r.count / base) * 1000) / 10 }));
  }

  it('교육 중 이탈자도 APPLIED·SELECTED·IN_TRAINING에는 도달한 것으로 센다', () => {
    // 5명 중 2명이 IN_TRAINING에서 이탈 → dropped_stage = IN_TRAINING으로 환산된 입력
    const rows = cumulative({ IN_TRAINING: 2, COMPLETED: 1, EXAM_PASSED: 1, PLACED: 1 });
    const at = (s: CohortStage) => rows.find((r) => r.stage === s)!;

    expect(at('APPLIED').count).toBe(5);
    expect(at('SELECTED').count).toBe(5);
    expect(at('IN_TRAINING').count).toBe(5);
    // 이탈이 드러나는 지점은 그 다음 단계다 — "교육 6주차 집중 이탈"
    expect(at('COMPLETED').count).toBe(3);
    expect(at('COMPLETED').conversionPct).toBe(60);
    expect(at('PLACED').count).toBe(1);
  });

  it('DROPPED는 퍼널 단계가 아니다 — 표시 순서에 들어가지 않는다', () => {
    expect(FUNNEL_STAGES).not.toContain('DROPPED');
  });

  it('아무도 없으면 전환율은 0이다 (0으로 나누지 않는다)', () => {
    expect(cumulative({}).every((r) => r.conversionPct === 0)).toBe(true);
  });
});
