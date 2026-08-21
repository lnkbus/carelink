import { makeLabeler } from '@carelink/ui';
/**
 * 도메인 코드 → 한국어 문구.
 *
 * 백엔드는 코드만 반환하고 문구는 클라이언트가 번역합니다 (§5.15). 그래서 이 표가
 * 화면 문구의 단일 출처입니다. DESK는 ko 전용이므로 여기에는 한국어만 둡니다 —
 * vi/ru/en은 FIELD(Candidate·Caregiver·Patient) 앱에서 필요합니다.
 *
 * 표에 없는 코드는 코드 원문을 그대로 보여줍니다. 빈칸이나 '알 수 없음'으로
 * 뭉개면 운영자가 무엇을 물어봐야 할지 알 수 없습니다.
 */
const DICT: Record<string, string> = {
  // 후보자 상태
  DRAFT: '작성 중', DOC_REVIEW: '서류 검토', TRAINING: '교육 중', READY: '배치 준비',
  MATCHED: '매칭됨', PLACED: '배치 완료', INACTIVE: '비활성', SUSPENDED: '정지',

  // 클리어런스
  IDENTITY_VERIFIED: '신원 확인', CRIMINAL_RECORD_CLEAR: '범죄경력 조회',
  HEALTH_CHECK: '건강진단', VISA_ELIGIBLE: '체류자격 적격',
  MANDATORY_TRAINING: '필수 교육', SCOPE_TRAINING: '업무범위 교육',
  PENDING: '대기', PASS: '통과', FAIL: '불합격', EXPIRED: '만료', N_A: '해당 없음',

  // 고용 모델 · 상태
  DIRECT_EMPLOYMENT: '직접고용', DELEGATION: '위탁', BROKERAGE: '순수중개',
  CONTRACT_PENDING: '계약 대기', ACTIVE: '진행 중', ENDED: '종료', TERMINATED: '해지',

  // 코호트 단계
  APPLIED: '지원', SELECTED: '선발', IN_TRAINING: '교육 중', COMPLETED: '수료',
  EXAM_PASSED: '자격 취득', DROPPED: '이탈',
  PLANNED: '계획', RECRUITING: '모집 중', EXAM: '시험', PLACEMENT: '배치',
  CLOSED: '종료',

  // 기관
  VERIFIED: '검증 완료', REJECTED: '반려', ELIGIBLE: '적격', INELIGIBLE: '부적격',
  NOT_APPLICABLE: '해당 없음', UNDER_REVIEW: '검토 중',
  NOT_REVIEWED: '미검토', CONDITIONAL: '조건부',

  // 업무범위 카테고리
  MEDICATION: '투약', INJECTION: '주사', SUCTION: '석션',
  WOUND_CARE: '처치', MEASUREMENT: '측정', OTHER: '기타',

  // 큐 유형
  DOC_VERIFY: '서류 검증', ORG_VERIFY: '기관 검증', APPLICATION_STALE: '지원 무응답',
  VISA_EXPIRING: '체류자격 만료 임박', CLEARANCE_EXPIRING: '클리어런스 만료 임박',
  OPS_REVIEW: '업무범위 검토',
  ORG_PENDING_VERIFICATION: '기관 검증 대기',
  DOC_UNDER_REVIEW: '서류 검토 대기',
  BREAK_NOT_RECORDED: '휴게 기록 없음',

  // 매칭 제외 사유
  CLEARANCE_INCOMPLETE: '클리어런스 미완',
  VISA_ELIGIBILITY: '체류자격 부적격',
  VISA_EXPIRED: '체류기간 만료',
  NOT_READY: '배치 준비 전',
  NOT_AVAILABLE: '근무 시작 불가',

  // 기관 유형
  HOSPITAL: '병원', NURSING_HOME: '요양기관', CLINIC: '의원', AGENCY: '중개기관',

  // 파트너 유형
  UNIVERSITY: '대학', TRAINING_CENTER: '교육기관', LANGUAGE_SCHOOL: '어학원',
  OVERSEAS_AGENCY: '현지 송출기관', LOCAL_GOVERNMENT: '지자체',
  PROSPECT: '접촉 전', IN_TALKS: '협의 중', MOU_SIGNED: 'MOU 체결', PAUSED: '중단',

  // 트랙
  HOSPITAL_CAREGIVER: '병원 간병', CARE_WORKER: '요양보호',
  HEALTHCARE_ASSISTANT: '의료지원',

  // 배치 종료 사유
  MODEL_SWITCH: '모델 전환',
};

export function label(code: string | null | undefined): string {
  if (!code) return '—';
  return DICT[code] ?? code;
}

/** 매칭 룰 코드 → 근거 문장. 점수만 보여주지 않기 위한 표입니다 (§5.6). */
const RULE_DICT: Record<string, string> = {
  REGION: '희망 근무지역이 맞습니다',
  EXPERIENCE: '요구 경력을 채웁니다',
  TRAINING: '필수 교육을 수료했습니다',
  DOCUMENT: '서류 검증이 끝났습니다',
  CONDITION: '근무 조건(고용형태·기숙사)이 맞습니다',
  LANGUAGE: '한국어 수준이 요건을 넘습니다',
};

export function ruleLabel(code: string): string {
  return RULE_DICT[code] ?? code;
}

/** 에러 코드 → 운영자에게 보여줄 문장. */
const ERROR_DICT: Record<string, string> = {
  QUALITY_CLEARANCE_INCOMPLETE: '클리어런스 6종이 전부 통과되지 않았습니다. 예외 배치 경로는 없습니다.',
  QUALITY_CLEARANCE_EXPIRED: '만료된 클리어런스가 있습니다. 재검사 후 다시 시도하세요.',
  ENGAGEMENT_COMPLIANCE_INCOMPLETE: '컴플라이언스 체크가 전부 통과되어야 진행할 수 있습니다.',
  ENGAGEMENT_PAYOUT_UNAVAILABLE: '급여 계산은 도급/파견 판정과 근로시간 규정 검토 이후에 열립니다.',
  ORG_NOT_VERIFIED: '검증되지 않은 기관입니다. 후보자 개인정보는 검증 이후에 열립니다.',
  RECRUITING_ATTRIBUTION_LOCKED: '유입 출처가 이미 기록되어 있습니다. 첫 접점이 우선합니다.',
  QUALITY_SHIFT_NOT_AVAILABLE: '지금은 선택할 수 없는 교대 방식입니다. 3교대로 진행하세요.',
  CARE_REST_PERIOD_TOO_SHORT: '직전 근무와의 간격이 11시간 미만입니다. 연속 교대는 사실상 24시간 근무가 됩니다.',
  CARE_SHIFT_OVERLAP: '이 간병사에게 겹치는 근무가 이미 있습니다.',
  TRACK_NO_REQUIREMENTS: '요건이 하나도 없는 트랙은 열 수 없습니다. 무엇을 확인할지 먼저 정의하세요.',
};

/**
 * 오류 문구.
 *
 * 공통 코드(COMMON_*·IAM_*·NETWORK)는 `@carelink/ui`의 사전에서 옵니다 —
 * 앱마다 따로 적으면 하나를 고칠 때 나머지를 잊습니다. 여기 ERROR_DICT에는
 * **이 앱에만 있는 도메인 코드**만 둡니다.
 */
export const errorLabel = makeLabeler('desk', ERROR_DICT);
