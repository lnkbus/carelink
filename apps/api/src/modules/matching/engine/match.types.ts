/** docs/02 §7.3 — SCR-204 / SCR-504가 그대로 소비하는 형태. */
export interface MatchResult {
  candidateId: string;
  displayCode: string;
  score: number;
  /** "지역 조건 일치 (경기) +25" — 항목마다 사유와 가중치를 함께 (docs/09 §7-3). */
  reasons: MatchReason[];
  /** "한국어 3급 (권장 4급)" — 부족한 것도 함께 준다. */
  missingRequirements: MatchReason[];
}

export interface MatchReason {
  ruleCode: string;
  /** 클라이언트가 번역할 키. 백엔드는 문구를 만들지 않는다. */
  messageKey: string;
  params: Record<string, unknown>;
  points: number;
  maxPoints: number;
}

/**
 * 하드 필터에 걸려 제외된 후보.
 *
 * 제외 사실만 반환하지 않는다. 화면은 "제외된 차단 건수와 사유"를 함께
 * 보여줘야 하고(SCR-504), 운영자가 사유를 모르면 우회로를 찾는다 (docs/09 §4.1-2).
 */
export interface MatchExclusion {
  candidateId: string;
  displayCode: string;
  filterCode: ExclusionFilter;
  reasonKey: string;
  params: Record<string, unknown>;
  /** 목록에서 아예 빼는가, 아니면 표시하되 자동 배정만 막는가. */
  severity: 'EXCLUDED' | 'BLOCKED_FOR_REVIEW';
}

export type ExclusionFilter =
  | 'STATUS_NOT_READY'
  | 'AVAILABILITY'
  | 'VISA_ELIGIBILITY'
  | 'VISA_EXPIRES_BEFORE_START'
  | 'CLEARANCE_INCOMPLETE'
  | 'MANDATORY_REQUIREMENT';

export interface MatchRunResult {
  jobId: string;
  matched: MatchResult[];
  excluded: MatchExclusion[];
  /** 하드 필터 이전의 전체 모수. 운영자가 "왜 3명뿐인가"를 물을 때 답이 된다. */
  scanned: number;
}
