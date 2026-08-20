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

/** 기관 관리자 승인이 필요한 역할. approved_at이 채워지기 전까지 권한이 없다. */
export const ROLES_REQUIRING_ORG_APPROVAL: readonly UserRole[] = ['ORG_MEMBER', 'ORG_ADMIN'];

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
