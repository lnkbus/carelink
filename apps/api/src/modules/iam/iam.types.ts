/** docs/02 §5.1 — 역할 8종. */
export type UserRole =
  | 'CANDIDATE'
  | 'CAREGIVER'
  | 'PATIENT_FAMILY'
  | 'ORG_MEMBER'
  | 'ORG_ADMIN'
  | 'PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

/**
 * SCR-003에서 본인이 직접 고를 수 있는 역할 4종.
 *
 * 시안은 3개(후보자·간병사·환자/보호자)였으나 SCREENS와 docs/02 §5.1을 기준으로
 * 기관(ORG_MEMBER)을 포함한 4개로 확정했다(S2). SCR-003의 next에 SCR-201(기관
 * 대시보드)이 들어 있어 기관 담당자도 이 화면을 지나간다.
 *
 * PARTNER·ADMIN·SUPER_ADMIN·ORG_ADMIN은 운영자가 부여하는 역할이라 여기 없다.
 */
export const SELF_SELECTABLE_ROLES = [
  'CANDIDATE',
  'CAREGIVER',
  'PATIENT_FAMILY',
  'ORG_MEMBER',
] as const satisfies readonly UserRole[];

export type SelfSelectableRole = (typeof SELF_SELECTABLE_ROLES)[number];

/**
 * 사람이 승인해야 열리는 역할 전체.
 *
 * 기관 역할은 **소속 승인**(이 사람이 우리 기관 사람이 맞나)이고,
 * 파트너는 **제휴 승인**(이 교육기관과 실제로 계약했나)입니다. 둘 다
 * `approved_at`이 NULL인 동안 대기이고, 승인하는 주체만 다릅니다.
 *
 * 후보자·간병사·보호자는 여기 없습니다. 본인이 고르면 그 자리에서 열립니다 —
 * 승인을 걸면 앱을 깔고 번호를 넣은 사람이 아무것도 못 하는 화면에서
 * 기다리게 되고, 그 사람은 돌아오지 않습니다.
 */
export const PENDING_APPROVAL_ROLES: readonly UserRole[] = ['ORG_MEMBER', 'ORG_ADMIN', 'PARTNER'];

/**
 * 이 역할이 승인 전까지 권한을 갖지 못하는가.
 *
 * **이 판정은 여기 한 곳입니다.** 종전에는 같은 목록이 둘 있었고
 * (`ROLES_REQUIRING_ORG_APPROVAL`), PARTNER를 한쪽에만 넣는 바람에 승인
 * 대기 중인 파트너가 권한을 그대로 받았습니다. 목록을 늘릴 때 두 곳을
 * 기억해야 하는 구조는 반드시 한쪽을 잊습니다.
 */
export function needsApproval(role: UserRole): boolean {
  return PENDING_APPROVAL_ROLES.includes(role);
}

/** docs/09 §6 · docs/12 D8 — 4개 언어. FIELD 트랙은 전부, DESK 트랙은 ko만. */
export const SUPPORTED_LOCALES = ['ko', 'vi', 'ru', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * docs/11 §2.3 — 동의 코드. 필수/선택을 한 화면 일괄 체크로 받으면 무효이므로
 * 항목별로 분리해 받고, 버전과 함께 적재한다.
 */
export const CONSENT_CODES = {
  TOS: { required: true },
  PRIVACY: { required: true },
  SENSITIVE_INFO: { required: true },
  OVERSEAS_TRANSFER: { required: false },   // 해당자 필수
  THIRD_PARTY_ORG: { required: true },
  THIRD_PARTY_INSURER: { required: false }, // 해당자 필수
  LOCATION: { required: false },
  MARKETING: { required: false },
} as const;

export type ConsentCode = keyof typeof CONSENT_CODES;

/** 가입 시점에 반드시 받아야 하는 동의. 없으면 가입이 성립하지 않는다. */
export const SIGNUP_REQUIRED_CONSENTS: readonly ConsentCode[] = ['TOS', 'PRIVACY'];
