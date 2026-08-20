import { MatchEngine, type CandidateFacts, type JobCriteria, type MatchingRule } from './match.engine';

/** 03_schema.sql의 matching_rules 시드와 같은 값. 하드코딩이 아니라 시드 복제다. */
const RULES: MatchingRule[] = [
  { ruleCode: 'REGION', maxPoints: 25, params: { exact: 25, province: 15 } },
  { ruleCode: 'EXPERIENCE', maxPoints: 20, params: { meets: 20, below: 0 } },
  { ruleCode: 'TRAINING', maxPoints: 20, params: { mandatory_completed: 20 } },
  { ruleCode: 'DOCUMENT', maxPoints: 15, params: { all_verified: 15, partial: 7 } },
  { ruleCode: 'CONDITION', maxPoints: 12, params: { dorm_match: 6, employment_type_match: 6 } },
  { ruleCode: 'LANGUAGE', maxPoints: 8, params: { meets: 8, one_below: 4 } },
];

const job = (over: Partial<JobCriteria> = {}): JobCriteria => ({
  jobId: 'j1', trackId: 't1', region: '경기 안산시', employmentType: 'FULL_TIME',
  minExperienceYears: 2, languageLevel: 'TOPIK_4', dormProvided: true,
  startDate: new Date('2026-10-01'), mandatoryRequirements: [], ...over,
});

const cand = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  candidateId: 'c1', displayCode: 'C-00101', status: 'READY',
  regions: ['경기 안산시'], availableFrom: new Date('2026-09-01'), dormRequired: false,
  employmentTypes: ['FULL_TIME'], experienceMonths: 38, koreanLevelCode: 'TOPIK_4',
  mandatoryTrainingDone: true, documentsAllVerified: true, documentsPartiallyVerified: false,
  visaStatusCode: 'F-5', visaExpiresOn: new Date('2029-01-01'),
  clearanceComplete: true, clearanceMissing: [],
  visaEligibility: 'ALLOWED', visaExcludes: false, visaBlocksAutoAssignment: false,
  visaReasonKey: 'visa.eligibility.ALLOWED', ...over,
});

const engine = new MatchEngine();
const run = (j = job(), cs: CandidateFacts[] = [cand()]) => engine.run(j, cs, RULES);

describe('MatchEngine — 하드 필터는 점수보다 먼저다', () => {
  it('비자 부적격은 점수가 아무리 높아도 제외된다', () => {
    const r = run(job(), [cand({ visaEligibility: 'NOT_ALLOWED', visaExcludes: true, visaReasonKey: 'visa.eligibility.NOT_ALLOWED' })]);
    expect(r.matched).toHaveLength(0);
    expect(r.excluded[0]).toMatchObject({ filterCode: 'VISA_ELIGIBILITY', severity: 'EXCLUDED' });
  });

  it('회색 영역은 제외가 아니라 자동 배정 차단이다', () => {
    // F-4 × 병원간병. 목록에는 남기되 운영자 검토 큐로 보낸다 (§5.9).
    const r = run(job(), [cand({ visaEligibility: 'PENDING_CONFIRMATION', visaBlocksAutoAssignment: true, visaReasonKey: 'visa.eligibility.PENDING_CONFIRMATION' })]);
    expect(r.matched).toHaveLength(1);
    expect(r.excluded[0].severity).toBe('BLOCKED_FOR_REVIEW');
  });

  it('배치 예정일 이후 체류자격이 만료되면 제외된다', () => {
    // 만료된 체류자격으로 배치되어 있으면 불법 취업이다.
    const r = run(job({ startDate: new Date('2026-12-01') }), [cand({ visaExpiresOn: new Date('2026-11-01') })]);
    expect(r.excluded[0].filterCode).toBe('VISA_EXPIRES_BEFORE_START');
  });

  it('클리어런스가 하나라도 빠지면 제외된다', () => {
    const r = run(job(), [cand({ clearanceComplete: false, clearanceMissing: ['SCOPE_TRAINING'] })]);
    expect(r.matched).toHaveLength(0);
    expect(r.excluded[0]).toMatchObject({ filterCode: 'CLEARANCE_INCOMPLETE' });
    expect(r.excluded[0].params.missing).toEqual(['SCOPE_TRAINING']);
  });

  it('READY가 아닌 후보자는 제외된다', () => {
    expect(run(job(), [cand({ status: 'TRAINING' })]).excluded[0].filterCode).toBe('STATUS_NOT_READY');
  });

  it('근무 가능일이 시작일보다 늦으면 제외된다', () => {
    const r = run(job({ startDate: new Date('2026-10-01') }), [cand({ availableFrom: new Date('2026-11-01') })]);
    expect(r.excluded[0].filterCode).toBe('AVAILABILITY');
  });

  it('제외에는 항상 사유가 붙는다', () => {
    // 사유 없는 차단은 운영자가 우회로를 찾게 만든다 (docs/09 §4.1-2).
    const r = run(job(), [cand({ clearanceComplete: false, clearanceMissing: ['HEALTH_CHECK'] })]);
    for (const e of r.excluded) {
      expect(e.reasonKey).toBeTruthy();
      expect(e.params).toBeDefined();
    }
  });

  it('제외되어도 모수는 보고된다', () => {
    const r = run(job(), [cand(), cand({ candidateId: 'c2', status: 'DRAFT' })]);
    expect(r.scanned).toBe(2);
    expect(r.matched).toHaveLength(1);
    expect(r.excluded).toHaveLength(1);
  });
});

describe('MatchEngine — 점수와 근거', () => {
  it('완벽한 후보는 100점이다', () => {
    const r = run();
    expect(r.matched[0].score).toBe(100);
    expect(r.matched[0].missingRequirements).toHaveLength(0);
  });

  it('점수만 주지 않는다 — 항목별 근거가 함께 나온다', () => {
    // 근거 없는 점수는 기관도 후보자도 신뢰하지 않는다 (§5.6).
    const r = run();
    expect(r.matched[0].reasons.length).toBeGreaterThanOrEqual(6);
    for (const reason of r.matched[0].reasons) {
      expect(reason).toMatchObject({ ruleCode: expect.any(String), messageKey: expect.any(String), points: expect.any(Number), maxPoints: expect.any(Number) });
    }
  });

  it('시/도만 일치하면 부분 점수다', () => {
    const r = run(job({ region: '경기 수원시' }), [cand({ regions: ['경기 안산시'] })]);
    const region = r.matched[0].reasons.find((x) => x.ruleCode === 'REGION');
    expect(region?.points).toBe(15);
    expect(region?.messageKey).toBe('match.reason.regionProvince');
  });

  it('지역이 아예 다르면 부족 항목으로 간다', () => {
    const r = run(job({ region: '부산 해운대구' }), [cand({ regions: ['경기 안산시'] })]);
    expect(r.matched[0].score).toBe(75);
    expect(r.matched[0].missingRequirements.map((m) => m.ruleCode)).toContain('REGION');
  });

  it('경력 미달은 0점이고 실제 경력이 사유에 담긴다', () => {
    const r = run(job({ minExperienceYears: 5 }), [cand({ experienceMonths: 38 })]);
    const exp = r.matched[0].missingRequirements.find((x) => x.ruleCode === 'EXPERIENCE');
    expect(exp?.params).toMatchObject({ years: 3.2, required: 5 });
  });

  it('필수교육 미이수는 20점을 잃는다', () => {
    expect(run(job(), [cand({ mandatoryTrainingDone: false })]).matched[0].score).toBe(80);
  });

  it('서류 일부 검증은 부분 점수다', () => {
    const r = run(job(), [cand({ documentsAllVerified: false, documentsPartiallyVerified: true })]);
    expect(r.matched[0].reasons.find((x) => x.ruleCode === 'DOCUMENT')?.points).toBe(7);
  });

  it('숙소가 필요한데 제공되지 않으면 조건 점수가 절반이다', () => {
    const r = run(job({ dormProvided: false }), [cand({ dormRequired: true })]);
    const cond = r.matched[0].reasons.find((x) => x.ruleCode === 'CONDITION');
    expect(cond?.points).toBe(6);
    expect(cond?.params.unmet).toEqual(['dorm']);
  });

  it('한국어가 한 등급 미달이면 절반 점수다', () => {
    const r = run(job({ languageLevel: 'TOPIK_4' }), [cand({ koreanLevelCode: 'TOPIK_3' })]);
    expect(r.matched[0].reasons.find((x) => x.ruleCode === 'LANGUAGE')?.points).toBe(4);
  });

  it('한국어가 두 등급 이상 미달이면 부족 항목이다', () => {
    const r = run(job({ languageLevel: 'TOPIK_4' }), [cand({ koreanLevelCode: 'TOPIK_2' })]);
    const lang = r.matched[0].missingRequirements.find((x) => x.ruleCode === 'LANGUAGE');
    expect(lang?.params).toMatchObject({ level: 'TOPIK_2', required: 'TOPIK_4' });
  });

  it('한국어 요건이 없는 공고는 언어를 채점하지 않는다', () => {
    const r = run(job({ languageLevel: null }), [cand({ koreanLevelCode: null })]);
    expect(r.matched[0].reasons.find((x) => x.ruleCode === 'LANGUAGE')).toBeUndefined();
    expect(r.matched[0].score).toBe(92);
  });

  it('점수 높은 순으로 정렬된다', () => {
    const r = run(job(), [
      cand({ candidateId: 'low', regions: ['부산 해운대구'], mandatoryTrainingDone: false }),
      cand({ candidateId: 'high' }),
    ]);
    expect(r.matched.map((m) => m.candidateId)).toEqual(['high', 'low']);
  });

  it('트랙별 가중치 오버라이드가 적용된다', () => {
    // 의료지원 트랙은 자격·서류 비중을 높인다 (시드의 track_matching_weights).
    const overridden = RULES.map((r) => (r.ruleCode === 'DOCUMENT' ? { ...r, maxPoints: 25, params: { all_verified: 25, partial: 12 } } : r));
    const r = engine.run(job(), [cand()], overridden);
    expect(r.matched[0].reasons.find((x) => x.ruleCode === 'DOCUMENT')?.points).toBe(25);
    expect(r.matched[0].score).toBe(110);
  });

  it('비활성 룰을 빼면 그만큼만 줄어든다', () => {
    const withoutLanguage = RULES.filter((r) => r.ruleCode !== 'LANGUAGE');
    expect(engine.run(job(), [cand()], withoutLanguage).matched[0].score).toBe(92);
  });
});

describe('MatchEngine — 국적은 입력값이 아니다', () => {
  it('CandidateFacts에 국적 필드가 없다', () => {
    // 타입에 없으므로 실수로도 참조할 수 없다 (§5.10 · docs/07 §2.2).
    expect(Object.keys(cand())).not.toContain('nationality');
  });

  it('같은 조건이면 체류자격이 달라도 점수가 같다', () => {
    // 체류자격은 하드 필터의 입력일 뿐 점수에 영향을 주지 않는다.
    const a = run(job(), [cand({ visaStatusCode: 'F-5' })]).matched[0].score;
    const b = run(job(), [cand({ visaStatusCode: 'F-6' })]).matched[0].score;
    const c = run(job(), [cand({ visaStatusCode: 'H-2' })]).matched[0].score;
    expect(new Set([a, b, c]).size).toBe(1);
  });
});
