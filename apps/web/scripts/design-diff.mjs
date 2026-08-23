/**
 * 시안과 실제 화면의 구조를 대조합니다.
 *
 *   node scripts/design-diff.mjs <시안> [실제주소]
 *
 *   <시안>      Claude Design 아티팩트 URL · 로컬 .html 파일 · file:// 주소
 *   [실제주소]  기본값 http://127.0.0.1:3100/
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────────
 * 시안이 올 때마다 사람이 눈으로 대조하면 반드시 놓칩니다. 실제로
 * 놓쳤습니다 — 시안이 5단계 섹션을 걷어냈는데 실물에는 남아 있어 같은
 * 이야기를 두 번 했고, '산업' 섹션은 내비에 없어 스크롤로만 닿았습니다.
 * 둘 다 스크린샷을 나란히 놓고 봐도 잘 안 보입니다.
 *
 * 그래서 **구조만** 뽑아 비교합니다: 섹션 id · 제목 · 내비 · 카드 수.
 * 색과 여백은 사람이 봐야 하지만, '섹션이 하나 더 있다'는 기계가 봅니다.
 *
 * ── 시안에 없어도 되는 것 ────────────────────────────────────────────
 * 정적 시안은 가입 경로도 4개 언어도 모릅니다. 그래서 차이를 '오류'가
 * 아니라 '차이'로 냅니다 — 판단은 사람이 합니다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

/**
 * playwright는 이 워크스페이스의 의존성이 아닙니다 — 디자인 대조는 가끔
 * 돌리는 도구라, 모든 설치에 브라우저 300MB를 얹지 않습니다. 전역에
 * 깔린 것을 찾아 씁니다. 없으면 무엇을 해야 하는지 말해 줍니다.
 */
async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    try {
      const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      const req = createRequire(resolve(globalRoot, 'x.js'));
      return req('playwright').chromium;
    } catch {
      console.error(
        'playwright가 없습니다. 설치:\n' +
        '  npm i -g playwright && npx playwright install chromium\n' +
        '이미 있다면 CHROMIUM_PATH로 실행 파일 경로를 넘기세요.',
      );
      process.exit(2);
    }
  }
}
const chromium = await loadChromium();

const [specArg, liveArg = 'http://127.0.0.1:3100/'] = process.argv.slice(2);
if (!specArg) {
  console.error('사용법: node scripts/design-diff.mjs <시안 URL|파일> [실제주소]');
  process.exit(2);
}

/**
 * 아티팩트 HTML에는 프레임 런타임이 앞에 붙습니다. 그대로 렌더하면
 * 그 스크립트가 부모 창을 찾다가 멈춥니다 — 잘라내고 씁니다.
 */
function stripFrameRuntime(html) {
  const end = html.indexOf('<!-- /frame-runtime -->');
  if (end === -1) return html;
  return '<!doctype html><html><head><meta charset="utf-8">' + html.slice(end + 23);
}

function specUrl(arg) {
  if (arg.startsWith('http')) return arg;
  const path = resolve(arg);
  const html = stripFrameRuntime(readFileSync(path, 'utf8'));
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

/** 페이지에서 구조만 뽑습니다. */
async function shape(page) {
  return page.evaluate(() => {
    const txt = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    return {
      sections: [...document.querySelectorAll('section[id],footer[id]')].map((e) => e.id),
      headings: [...document.querySelectorAll('h1,h2')].map((e) => txt(e).slice(0, 40)),
      nav: [...document.querySelectorAll('header a, header button, nav a, nav button')]
        .map(txt).filter(Boolean),
      // 카드가 몇 장인지 — 산업 하나가 빠져도 눈으로는 잘 안 보입니다.
      cards: [...document.querySelectorAll('section')].map((s) => ({
        id: s.id || '(무명)',
        n: s.querySelectorAll(':scope > * > [class*="card"], :scope > * > li, :scope > a').length,
      })).filter((c) => c.n > 0),
      height: document.body.scrollHeight,
    };
  });
}

function diffList(label, a, b) {
  const onlyA = a.filter((x) => !b.includes(x));
  const onlyB = b.filter((x) => !a.includes(x));
  if (!onlyA.length && !onlyB.length) {
    console.log(`  ${label}: 일치 (${a.length}개)`);
    return 0;
  }
  console.log(`  ${label}:`);
  onlyA.forEach((x) => console.log(`    − 시안에만: ${x}`));
  onlyB.forEach((x) => console.log(`    + 실물에만: ${x}`));
  return onlyA.length + onlyB.length;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const shapes = {};
for (const [tag, url] of [['시안', specUrl(specArg)], ['실물', liveArg]]) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle' });
  shapes[tag] = await shape(p);
  await p.close();
}

console.log('\n══ 구조 대조 ══');
let diffs = 0;
diffs += diffList('섹션', shapes['시안'].sections, shapes['실물'].sections);
diffs += diffList('제목', shapes['시안'].headings, shapes['실물'].headings);
diffs += diffList('내비', shapes['시안'].nav, shapes['실물'].nav);

// 카드 수는 **참고값**입니다. 시안은 div로, 실물은 li로 그릴 수 있어
// 마크업이 다르면 숫자가 어긋납니다. '0 대 8'은 대개 선택자 차이입니다.
console.log('\n  카드 수 (참고 — 마크업이 다르면 어긋납니다):');
const ids = new Set([...shapes['시안'].cards, ...shapes['실물'].cards].map((c) => c.id));
for (const id of ids) {
  const a = shapes['시안'].cards.find((c) => c.id === id)?.n ?? 0;
  const b = shapes['실물'].cards.find((c) => c.id === id)?.n ?? 0;
  console.log(`    ${id}: 시안 ${a} · 실물 ${b}${a !== b ? '  ← 다름' : ''}`);
}
console.log(`\n  높이: 시안 ${shapes['시안'].height}px · 실물 ${shapes['실물'].height}px`);
console.log(`\n차이 ${diffs}건. 시안에 없는 기능(가입 경로·다국어)은 정상입니다 — 판단은 사람이.\n`);

await browser.close();
