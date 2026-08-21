import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 디자인 토큰이 **웹과 앱에서 같은 값인지** 확인한다.
 *
 * 웹은 `tokens.css`, Flutter는 `tokens.dart`에 따로 적혀 있다. 한쪽만
 * 고치면 같은 화면이 앱과 웹에서 다르게 보이고, 그건 눈으로 비교하기
 * 전까지 아무도 모른다 — 실제로 보호자 웹이 상향 스케일 대신 일반 FIELD
 * 값을 쓰고 있었고 몇 주 동안 발견되지 않았다.
 *
 * 값을 바꿀 때는 design/README §타이포를 먼저 고치고 두 파일을 함께 옮긴다.
 */
const ROOT = join(__dirname, '../../..');
const css = readFileSync(join(ROOT, 'packages/ui/src/tokens/tokens.css'), 'utf8');
const dart = readFileSync(join(ROOT, 'packages/field_ui/lib/src/tokens.dart'), 'utf8');

function cssVar(name: string): number {
  const m = css.match(new RegExp(`--${name}:\\s*([0-9.]+)px`));
  if (!m) throw new Error(`토큰 없음: --${name}`);
  return Number(m[1]);
}

/** `class CL {` / `class CLUp {` 블록 안에서만 찾는다. */
function dartConst(cls: string, name: string): number {
  const start = dart.indexOf(`class ${cls} {`);
  if (start < 0) throw new Error(`클래스 없음: ${cls}`);
  const end = dart.indexOf('\n}', start);
  const block = dart.slice(start, end);
  const m = block.match(new RegExp(`static const ${name} = ([0-9.]+)`));
  if (!m) throw new Error(`상수 없음: ${cls}.${name}`);
  return Number(m[1]);
}

describe('타이포 스케일 — 웹과 앱이 같은 값', () => {
  const scale = ['display', 'title', 'subtitle', 'body', 'caption'] as const;

  it.each(scale)('FIELD %s — --cf-*와 CL.*', (key) => {
    expect(dartConst('CL', key)).toBe(cssVar(`cf-${key}`));
  });

  it.each(scale)('FIELD 상향 %s — --cu-*와 CLUp.*', (key) => {
    expect(dartConst('CLUp', key)).toBe(cssVar(`cu-${key}`));
  });
});

describe('터치 타깃', () => {
  it('FIELD 48px', () => {
    expect(dartConst('CL', 'minTapTarget')).toBe(cssVar('cl-tap-field'));
  });

  it('상향 주요 액션 64px · 히어로 76px', () => {
    // 앱의 히어로는 76px(간병사 버튼), 웹의 히어로는 88px(보호자 신청)입니다.
    // 시안이 '주요 액션 64~88px' 범위를 주고 화면마다 지정했기 때문입니다.
    expect(dartConst('CLUp', 'primaryButtonHeight')).toBe(cssVar('cl-tap-action'));
    expect(dartConst('CLUp', 'heroButtonHeight')).toBe(76);
  });
});

describe('FIELD에는 Micro가 없다', () => {
  it('토큰 자체를 정의하지 않는다 — 쓸 수 있게 두면 언젠가 쓰인다', () => {
    expect(css).toMatch(/--cl-micro/);          // DESK에는 있고
    expect(css).not.toMatch(/--cf-micro/);      // FIELD에는 없다
    expect(css).not.toMatch(/--cu-micro/);
    expect(dart).not.toMatch(/static const micro/);
  });
});
