/**
 * 문구 사전의 **공통 뼈대**.
 *
 * 백엔드는 코드만 반환하고 문구는 클라이언트가 번역합니다 (§5.15). 그래서
 * 사전은 앱마다 있는 것이 맞습니다 — 보호자에게 `TRACK_NO_REQUIREMENTS`는
 * 아무 의미도 없습니다.
 *
 * 다만 **공통 코드는 한 곳에서 나와야** 합니다. `IAM_TOKEN_INVALID`가
 * 앱마다 따로 적혀 있으면 하나를 고칠 때 나머지를 잊습니다.
 *
 * ── 레지스터가 둘인 이유 ────────────────────────────────────────────────
 * 같은 코드라도 읽는 사람이 다릅니다.
 *
 *   DESK  운영자·기관 담당자. 하루에 수십 번 봅니다. 간결한 것이 낫습니다.
 *         "허용되지 않는 상태 변경입니다."
 *   FIELD 보호자·후보자·간병사. 처음 보고 급합니다. **다음에 무엇을 하면
 *         되는지**까지 말해야 합니다.
 *         "지금은 할 수 없는 동작입니다. 화면을 새로고침해 주세요."
 *
 * 이 차이는 실수가 아니라 규칙입니다. 하나로 합치면 한쪽이 반드시 나빠집니다.
 */

/** 어느 화면에서나 나올 수 있는 코드. */
const COMMON_DESK: Record<string, string> = {
  COMMON_VALIDATION_FAILED: '입력값을 다시 확인하세요.',
  COMMON_NOT_FOUND: '대상을 찾을 수 없습니다.',
  COMMON_INVALID_TRANSITION: '허용되지 않는 상태 변경입니다.',
  COMMON_INTERNAL_ERROR: '처리 중 오류가 발생했습니다.',
  IAM_TOKEN_INVALID: '세션이 만료되었습니다. 다시 로그인하세요.',
  IAM_TOKEN_EXPIRED: '세션이 만료되었습니다. 다시 로그인하세요.',
  IAM_ROLE_FORBIDDEN: '이 요청을 볼 권한이 없습니다.',
  IAM_OTP_INVALID: '인증번호가 맞지 않습니다.',
  IAM_OTP_RATE_LIMITED: '잠시 후 다시 시도하세요.',
  IAM_OTP_TOO_MANY_ATTEMPTS: '인증번호를 여러 번 틀렸습니다. 잠시 후 다시 시도하세요.',
  IAM_PHONE_INVALID: '번호를 다시 확인해 주세요. 해외 번호는 국가번호를 붙여 주세요 (예: +84).',
  NETWORK: '서버에 연결하지 못했습니다. 네트워크를 확인하세요.',
};

const COMMON_FIELD: Record<string, string> = {
  COMMON_VALIDATION_FAILED: '입력하신 내용을 다시 확인해 주세요.',
  COMMON_NOT_FOUND: '찾으시는 내용이 없습니다.',
  COMMON_INVALID_TRANSITION: '지금은 할 수 없는 동작입니다. 화면을 새로고침해 주세요.',
  COMMON_INTERNAL_ERROR: '잠시 문제가 있었습니다. 다시 시도해 주세요.',
  IAM_TOKEN_INVALID: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
  IAM_TOKEN_EXPIRED: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
  IAM_ROLE_FORBIDDEN: '이 화면을 볼 권한이 없는 계정입니다.',
  IAM_OTP_INVALID: '인증번호가 맞지 않습니다. 다시 확인해 주세요.',
  IAM_OTP_RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  IAM_OTP_TOO_MANY_ATTEMPTS: '인증번호를 여러 번 틀렸습니다. 잠시 후 다시 시도해 주세요.',
  IAM_PHONE_INVALID: '번호를 다시 확인해 주세요. 해외 번호는 국가번호가 필요합니다 (예: +84).',
  NETWORK: '연결이 불안정합니다. 잠시 후 다시 시도해 주세요.',
};

export type Register = 'desk' | 'field';

/**
 * 앱별 사전을 공통 사전 위에 얹습니다.
 *
 * **모르는 코드는 코드 그대로 돌려줍니다.** 빈 문자열을 주면 화면이 비고,
 * 그러면 무슨 일이 일어났는지 아무도 모릅니다. 코드라도 보이면 로그에서
 * 찾을 수 있습니다.
 */
export function makeLabeler(
  register: Register,
  own: Record<string, string> = {},
): (code: string | null | undefined) => string {
  const base = register === 'desk' ? COMMON_DESK : COMMON_FIELD;
  const dict = { ...base, ...own };
  return (code) => (code ? dict[code] ?? code : '—');
}

/** 공통 코드 목록. 앱 사전이 이걸 덮어쓰려 하면 이유가 있어야 합니다. */
export const COMMON_CODES = Object.keys(COMMON_DESK);
