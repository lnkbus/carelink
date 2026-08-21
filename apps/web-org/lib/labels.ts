import { makeLabeler } from '@carelink/ui';
/**
 * 도메인 코드 → 한국어 문구. 백엔드는 코드만 반환합니다 (§5.15).
 *
 * 기관 화면 전용 사전입니다. 운영 콘솔과 같은 코드라도 기관에는 다르게
 * 보여줘야 하는 것이 있습니다 — 예를 들어 체류자격 코드는 여기 아예 없습니다.
 * 기관에는 '취업 가능 여부'만 나가기 때문입니다 (§6-12).
 */
const DICT: Record<string, string> = {
  // 지원 상태
  APPLIED: '지원', SCREENING: '검토 중', INTERVIEW_REQUESTED: '면접 요청',
  INTERVIEW_SCHEDULED: '면접 예정', OFFERED: '제안', HIRED: '채용',
  REJECTED: '불합격', WITHDRAWN: '철회',

  // 면접
  REQUESTED: '수락 대기', CONFIRMED: '확정', COMPLETED: '완료',
  CANCELLED: '취소', NO_SHOW: '불참',
  ONSITE: '현장', VIDEO: '화상', PHONE: '전화',

  // 채용 요청
  DRAFT: '작성 중', OPEN: '모집 중', PAUSED: '일시중지',
  FILLED: '충원 완료', CLOSED: '마감', EXPIRED: '만료',

  // 급여 공개 범위
  PUBLIC: '공개', AFTER_MATCH: '매칭 후 공개', NEGOTIABLE: '협의',

  // 기관 검증
  VERIFIED: '검증 완료', PENDING: '검증 대기', UNDER_REVIEW: '검토 중',
  SUSPENDED: '정지',

  // 트랙
  HOSPITAL_CAREGIVER: '병원 간병', CARE_WORKER: '요양보호',
  HEALTHCARE_ASSISTANT: '의료지원',

  // 후보자 여정 (기관에도 보이는 범위)
  DOC_REVIEW: '서류 검토', TRAINING: '교육 중', READY: '배치 준비',
  MATCHED: '매칭됨', PLACED: '배치 완료',

  // 기관 유형
  HOSPITAL: '병원', NURSING_HOME: '요양기관', CLINIC: '의원',
};

export function label(code: string | null | undefined): string {
  if (!code) return '—';
  return DICT[code] ?? code;
}

/** 매칭 룰 코드 → 근거 문장. 점수는 근거와 함께만 의미가 있습니다 (§5.6). */
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

const ERROR_DICT: Record<string, string> = {
  ORG_NOT_VERIFIED: '기관 검증이 끝나야 후보자 정보를 볼 수 있습니다. 사업자등록증 검토 중입니다.',
  ORG_NOT_FOUND: '승인된 기관 소속이 아닙니다. 관리자에게 소속 승인을 요청하세요.',
  ORG_E7_SPONSOR_INELIGIBLE: 'E-7-2 스폰서 자격이 확인되지 않아 외국인력을 배치할 수 없습니다.',
  MATCHING_JOB_NOT_OPEN: '모집 중인 채용 요청이 아닙니다.',
};

export function errorLabel(code: string): string {
  return ERROR_DICT[code] ?? code;
}
