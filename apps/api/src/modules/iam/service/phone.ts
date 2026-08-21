import { DomainError } from '../../../core/errors/domain-error';

/** 국내 기본 국가번호. 0으로 시작하는 번호는 한국 번호로 해석한다. */
const DEFAULT_DIAL = '+82';

/** E.164 — `+` 뒤 국가번호(0으로 시작하지 않음) 포함 8~15자리. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * 전화번호를 E.164로 정규화한다.
 *
 * **저장 형식이 하나여야 한다.** 이 번호가 계정의 유일한 식별자이기 때문이다.
 * `010 4821 8821` · `010-4821-8821` · `+82 10 4821 8821`이 서로 다른 문자열로
 * 저장되면 같은 사람에게 계정이 세 개 생기고, 그중 어느 계정에 서류와
 * 클리어런스가 붙었는지 아무도 모른다.
 *
 * 2026-08-21 확정으로 **해외 거주 후보자가 국제번호로 직접 가입**한다
 * (docs/08 E·F 세그먼트 — 현지 고려인, 베트남 양성대학). 그래서 국내 형식만
 * 받던 것을 국가번호까지 받도록 넓히되, 저장은 한 형식으로 못 박는다.
 *
 *   01048218821        → +821048218821
 *   +84 91 234 5678    → +84912345678
 *   0084912345678      → +84912345678   (국제전화 접두 00)
 *
 * **0으로도 +로도 시작하지 않는 값은 거절한다.** `1048218821`을 한국 번호로
 * 추측해서 붙이면, 정말 그 나라 번호였던 사람이 남의 계정으로 들어간다.
 * 추측하느니 무엇을 붙이라고 말하는 편이 낫다.
 */
export function normalizePhone(raw: string): string {
  const trimmed = (raw ?? '').trim();
  const digits = trimmed.replace(/\D/g, '');

  let e164: string;
  if (trimmed.startsWith('+')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`;
  } else if (digits.startsWith('0')) {
    e164 = `${DEFAULT_DIAL}${digits.slice(1)}`;
  } else {
    throw new DomainError('IAM_PHONE_INVALID', { reason: 'MISSING_COUNTRY_CODE' });
  }

  if (!E164.test(e164)) {
    throw new DomainError('IAM_PHONE_INVALID', { reason: 'NOT_E164' });
  }
  return e164;
}

/**
 * 화면에 보여 줄 형태.
 *
 * 한국 번호는 저장값(+8210…)이 아니라 익숙한 010… 으로 되돌린다 —
 * 자기 번호를 못 알아보면 로그인한 계정이 자기 것인지 확신할 수 없다.
 * 해외 번호는 국가번호가 정보이므로 그대로 둔다.
 */
export function displayPhone(e164: string | null): string | null {
  if (!e164) return e164;
  return e164.startsWith(DEFAULT_DIAL) ? `0${e164.slice(DEFAULT_DIAL.length)}` : e164;
}
