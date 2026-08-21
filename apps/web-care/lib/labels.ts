/**
 * 도메인 코드 → 한국어 문구. 백엔드는 코드만 반환합니다 (§5.15).
 *
 * **보호자 전용 사전입니다.** 운영 콘솔과 같은 코드라도 보호자에게는 다르게
 * 보여줘야 합니다. 특히 여기에 **없는** 것이 중요합니다 —
 *   · 국적·체류자격 (§6-21 · §5.10)
 *   · 간병사 실명·연락처
 *   · 에스컬레이션 경로 같은 내부 처리 정보
 * 사전에 없으면 화면에 그릴 수도 없습니다.
 */
const DICT: Record<string, string> = {
  // 간병 요청
  DRAFT: '작성 중', SUBMITTED: '접수됨', MATCHING: '간병사 찾는 중',
  OFFER_SENT: '수락 기다리는 중', ASSIGNED: '배정 완료', IN_SERVICE: '간병 중',
  COMPLETED: '완료', CANCELLED: '취소', OPS_REVIEW: '확인 중', ISSUE: '지연',

  // 배정
  OFFERED: '제안 보냄', ACCEPTED: '간병사 수락', DECLINED: '거절',

  // 서비스 유형
  DAY: '주간', NIGHT: '야간', H24: '24시간', SPOT: '단기',

  // 교대 패턴
  H8_3SHIFT: '8시간 3교대', H12_2SHIFT: '12시간 2교대', H24_LIVE_IN: '24시간 상주',

  // 거동 수준
  INDEPENDENT: '스스로 가능', PARTIAL_ASSIST: '부분 도움 필요', FULL_ASSIST: '전적인 도움 필요',

  // 기록 유형
  SHIFT_START: '근무 시작', SHIFT_END: '근무 종료',
  SUPPORT: '지원 기록', NOTE: '메모', ISSUE_LOG: '특이사항',
};

export function label(code: string | null | undefined): string {
  if (!code) return '—';
  return DICT[code] ?? code;
}

/**
 * 매칭에서 제외된 이유.
 *
 * **몇 명이 왜 빠졌는지 보호자에게 알립니다.** "후보가 3명뿐"과 "12명 중
 * 9명이 검증 기간이 지나 빠졌다"는 전혀 다른 정보이고, 후자를 감추면
 * 보호자는 플랫폼에 사람이 없다고 판단합니다.
 */
const EXCLUSION: Record<string, string> = {
  CLEARANCE_INCOMPLETE: '배치 전 검증이 끝나지 않아 제외',
  CLEARANCE_EXPIRED: '검증 유효기간이 지나 제외',
  NOT_AVAILABLE: '해당 기간에 일정이 없어 제외',
};

export function exclusionLabel(code: string): string {
  return EXCLUSION[code] ?? '조건이 맞지 않아 제외';
}

/**
 * 도메인 오류 → 보호자가 읽을 문장.
 *
 * 영어 메시지를 그대로 띄우지 않습니다. 그리고 **무엇을 하면 되는지**까지
 * 적습니다 — "권한이 없습니다"만 뜨는 화면에서 사람은 다음 행동을
 * 정할 수 없습니다.
 */
const ERRORS: Record<string, string> = {
  CARE_SCOPE_REVIEW_REQUIRED:
    '적어 주신 내용에 간병사가 할 수 없는 일이 포함된 것 같습니다. 담당자가 확인 후 연락드립니다.',
  CARE_UNKNOWN_SERVICE_ITEM:
    '선택할 수 없는 항목입니다. 투약·주사·처치 같은 의료행위는 간병사가 할 수 없습니다.',
  QUALITY_SHIFT_NOT_AVAILABLE:
    '지금은 24시간 상주를 신청할 수 없습니다. 8시간 3교대로 같은 시간을 채울 수 있습니다.',
  CARE_REST_PERIOD_TOO_SHORT:
    '이 간병사는 직전 근무와 너무 가까워 배정할 수 없습니다. 다른 분을 선택해 주세요.',
  CARE_SHIFT_OVERLAP:
    '이 간병사는 같은 시간에 다른 근무가 있습니다. 다른 분을 선택해 주세요.',
  QUALITY_SHIFT_NEEDS_APPROVAL:
    '24시간 상주는 담당자 확인 후 진행됩니다. 접수됐고 곧 연락드립니다.',
  QUALITY_SHIFT_NOT_ALLOWED_FOR_WORKER:
    '이 간병사는 24시간 상주를 맡을 수 없습니다. 다른 간병사를 선택해 주세요.',
  CARE_SLA_BREACHED: '배정이 지연되고 있습니다. 담당자가 확인 중입니다.',
  COMMON_INVALID_TRANSITION: '지금은 할 수 없는 동작입니다. 화면을 새로고침해 주세요.',
  COMMON_NOT_FOUND: '요청을 찾을 수 없습니다.',
  IAM_ROLE_FORBIDDEN: '이 요청을 볼 권한이 없습니다.',
  IAM_TOKEN_INVALID: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
  IAM_OTP_TOO_MANY_ATTEMPTS: '인증번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.',
  COMMON_VALIDATION_FAILED: '입력한 내용을 다시 확인해 주세요.',
  NETWORK: '연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
};

export function errorLabel(code: string | null | undefined): string {
  if (!code) return ERRORS.NETWORK;
  return ERRORS[code] ?? '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 날짜·시각. 보호자 화면은 항상 현지(KST) 벽시계로 보여줍니다. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul', hour12: false,
  }).format(d);
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hour12: false,
  }).format(new Date(iso));
}
