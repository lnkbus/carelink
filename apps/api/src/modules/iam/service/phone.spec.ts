import { DomainError } from '../../../core/errors/domain-error';
import { displayPhone, normalizePhone } from './phone';

/**
 * 전화번호가 계정의 유일한 식별자다. 같은 사람이 다른 문자열로 저장되면
 * 계정이 갈라지고, 서류·클리어런스가 어느 쪽에 붙었는지 알 수 없게 된다.
 */
describe('normalizePhone', () => {
  it('국내 번호의 표기 차이를 한 값으로 모은다', () => {
    for (const raw of ['01048218821', '010-4821-8821', '010 4821 8821', ' 010.4821.8821 ']) {
      expect(normalizePhone(raw)).toBe('+821048218821');
    }
  });

  it('국내 번호를 국가번호로 써도 같은 값이 된다', () => {
    // 같은 사람이 앱에서는 010…, 웹에서는 +82…로 넣을 수 있다.
    for (const raw of ['+821048218821', '+82 10 4821 8821', '0082 10 4821 8821']) {
      expect(normalizePhone(raw)).toBe('+821048218821');
    }
  });

  it('해외 번호를 받는다 — 2026-08-21 확정 (docs/08 E·F 세그먼트)', () => {
    expect(normalizePhone('+84912345678')).toBe('+84912345678');   // 베트남
    expect(normalizePhone('+84 91 234 5678')).toBe('+84912345678');
    expect(normalizePhone('0084912345678')).toBe('+84912345678');
    expect(normalizePhone('+998901234567')).toBe('+998901234567'); // 우즈베키스탄
  });

  it('국가번호도 0도 없는 값은 추측하지 않고 거절한다', () => {
    // '1048218821'을 한국 번호로 추측해 붙이면, 정말 그 나라 번호였던
    // 사람이 남의 계정으로 들어간다.
    expect(() => normalizePhone('1048218821')).toThrow(DomainError);
    try {
      normalizePhone('1048218821');
    } catch (e) {
      expect((e as DomainError).code).toBe('IAM_PHONE_INVALID');
    }
  });

  it('E.164를 벗어나는 값은 거절한다', () => {
    expect(() => normalizePhone('+0123456789')).toThrow(DomainError);  // 국가번호가 0으로 시작
    expect(() => normalizePhone('010123')).toThrow(DomainError);       // 너무 짧음
    expect(() => normalizePhone('+8210482188210000000')).toThrow(DomainError); // 너무 김
    expect(() => normalizePhone('')).toThrow(DomainError);
  });
});

describe('displayPhone', () => {
  it('한국 번호는 익숙한 010…으로 되돌린다', () => {
    // 자기 번호를 못 알아보면 로그인한 계정이 자기 것인지 확신할 수 없다.
    expect(displayPhone('+821048218821')).toBe('01048218821');
  });

  it('해외 번호는 국가번호가 정보이므로 그대로 둔다', () => {
    expect(displayPhone('+84912345678')).toBe('+84912345678');
  });

  it('없는 값은 그대로 통과시킨다', () => {
    expect(displayPhone(null)).toBeNull();
  });
});
