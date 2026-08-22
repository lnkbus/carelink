import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderTemplate } from './notification.service';

/**
 * 알림 문구 사전을 검사합니다.
 *
 * 마이그레이션 SQL을 **파일로 읽어** 확인합니다. DB를 띄우지 않고도 돌아야
 * 하고, 어차피 틀리는 지점은 사람이 SQL을 손으로 늘릴 때입니다 — 코드를
 * 하나 추가하면서 언어 넷 중 하나를 빠뜨리는 것.
 *
 * 그때 그 언어 사용자에게는 한국어가 나갑니다(ko 대비). 도달은 하지만
 * 읽히지 않고, 아무도 오류로 보고하지 않습니다.
 */

const SQL = readFileSync(
  join(__dirname, '../../../../../../infra/migrations/0004_notification_templates.sql'),
  'utf8',
);

const LOCALES = ['ko', 'vi', 'ru', 'en'];

/** `('CODE','locale','CHANNEL',...` 를 훑습니다. */
function rows(): { code: string; locale: string; channel: string }[] {
  const out: { code: string; locale: string; channel: string }[] = [];
  const re = /^\('([A-Z_]+)','([a-z]{2})','([A-Z]+)'/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SQL)) !== null) out.push({ code: m[1], locale: m[2], channel: m[3] });
  return out;
}

describe('알림 템플릿', () => {
  const all = rows();

  it('행을 읽어냈다 — 정규식이 헛돌면 나머지 검사가 전부 통과합니다', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it('모든 코드에 4개 언어가 다 있다', () => {
    const byCode = new Map<string, Set<string>>();
    for (const r of all) {
      if (!byCode.has(r.code)) byCode.set(r.code, new Set());
      byCode.get(r.code)!.add(r.locale);
    }
    const missing: string[] = [];
    for (const [code, locales] of byCode) {
      for (const l of LOCALES) if (!locales.has(l)) missing.push(`${code}:${l}`);
    }
    expect(missing).toEqual([]);
  });

  it('같은 (코드·언어·채널)이 두 번 나오지 않는다 — UNIQUE가 있지만 SQL이 먼저 죽습니다', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const r of all) {
      const k = `${r.code}|${r.locale}|${r.channel}`;
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes).toEqual([]);
  });

  it('반려 문구에는 사유 자리가 있다', () => {
    // 반려는 신청 행을 지우므로 이 문구가 사유가 닿는 유일한 경로입니다.
    for (const l of LOCALES) {
      const line = SQL.split('\n').find((x) => x.startsWith(`('IAM_ROLE_REJECTED','${l}'`));
      expect(line).toBeDefined();
      expect(line).toContain('{reason}');
    }
  });
});

describe('renderTemplate', () => {
  it('payload로 자리를 채운다', () => {
    expect(renderTemplate('{organizationName} 담당자로 승인되었습니다', { organizationName: '서울중앙요양병원' }))
      .toBe('서울중앙요양병원 담당자로 승인되었습니다');
  });

  it('여러 자리를 채운다', () => {
    expect(renderTemplate('{a}와 {b}', { a: '하나', b: '둘' })).toBe('하나와 둘');
  });

  it('없는 키는 **지우지 않고 그대로 둔다**', () => {
    // 빈 문자열로 지우면 '님의 신청이 되었습니다'처럼 말은 되는데 뜻이
    // 없는 문장이 나가고, 그건 틀린 줄도 모릅니다.
    expect(renderTemplate('{who}님의 신청', {})).toBe('{who}님의 신청');
  });

  it('null 값도 그대로 둔다 — 기관 없는 파트너 신청', () => {
    expect(renderTemplate('{organizationName} 담당자', { organizationName: null }))
      .toBe('{organizationName} 담당자');
  });

  it('본문이 없으면 그대로 null', () => {
    expect(renderTemplate(null, { a: 1 })).toBeNull();
  });
});
