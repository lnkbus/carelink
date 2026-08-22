import { DICT_FOR_TEST, LOCALES, NUMERIC_KEYS, makeT, pickLocale } from '../lib/intro-i18n';

/**
 * 인트로 4개 언어 대조.
 *
 * 앱의 `test/i18n_test.dart`와 같은 이유입니다 — 사람이 눈으로 네 언어를
 * 맞추는 방식은 키가 늘어나는 순간 실패합니다. 빠진 키는 화면에서 한국어로
 * 보이고, 그걸 발견하는 사람은 그 언어를 쓰는 사용자뿐이며 그때는 이미
 * 배포된 뒤입니다.
 *
 * 러시아어가 필요한 이유는 고려인 세그먼트입니다 (docs/08). 장식이 아닙니다.
 */
describe('인트로 문구', () => {
  const ko = DICT_FOR_TEST.ko;

  it('네 언어의 키 집합이 정확히 같다', () => {
    const base = Object.keys(ko).sort();
    for (const l of LOCALES) {
      expect(Object.keys(DICT_FOR_TEST[l]).sort()).toEqual(base);
    }
  });

  it('빈 문자열인 번역이 없다', () => {
    const blanks: string[] = [];
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries(DICT_FOR_TEST[l])) {
        if (!v.trim()) blanks.push(`${k} → ${l}`);
      }
    }
    expect(blanks).toEqual([]);
  });

  it('한국어를 그대로 복사한 다른 언어가 없다', () => {
    // 복사는 '번역했다'고 착각하게 만듭니다. 빠진 것보다 찾기 어렵습니다.
    const copies: string[] = [];
    for (const l of LOCALES) {
      if (l === 'ko') continue;
      for (const [k, v] of Object.entries(DICT_FOR_TEST[l])) {
        // 숫자는 번역이 아닙니다 — `86`은 네 언어에서 `86`입니다.
        if (NUMERIC_KEYS.includes(k)) continue;
        if (v === ko[k]) copies.push(`${k} → ${l}`);
      }
    }
    expect(copies).toEqual([]);
  });

  it('줄바꿈이 든 문구는 네 언어 모두 줄 수가 같다', () => {
    // 한쪽만 2줄이면 그 언어에서 제목 높이가 달라져 히어로가 어긋납니다.
    for (const [k, v] of Object.entries(ko)) {
      if (!v.includes('\n')) continue;
      for (const l of LOCALES) {
        expect(DICT_FOR_TEST[l][k].split('\n').length).toBe(v.split('\n').length);
      }
    }
  });

  it('없는 키는 한국어로, 그것도 없으면 키 원문을 돌려준다', () => {
    expect(makeT('vi')('nav.login')).toBe(DICT_FOR_TEST.vi['nav.login']);
    expect(makeT('vi')('no.such.key')).toBe('no.such.key');
  });

  it('알 수 없는 lang은 한국어로 떨어진다', () => {
    // 주소를 손으로 고친 사람에게 빈 화면을 주지 않습니다.
    expect(pickLocale('vi')).toBe('vi');
    expect(pickLocale('zh')).toBe('ko');
    expect(pickLocale(undefined)).toBe('ko');
    expect(pickLocale(['ru', 'en'])).toBe('ru');
  });

  it('숫자 값에 한글 단위가 남아 있지 않다', () => {
    // `18일`을 러시아어 화면에 그대로 두면 읽히지 않는 글자입니다.
    for (const l of LOCALES) {
      if (l === 'ko') continue;
      for (const k of NUMERIC_KEYS) {
        expect(DICT_FOR_TEST[l][k]).not.toMatch(/[가-힣]/);
      }
    }
  });

  it('러시아어가 목록에 있다 — 고려인 세그먼트 (docs/08)', () => {
    expect(LOCALES).toContain('ru');
    expect(LOCALES).toHaveLength(4);
  });
});
