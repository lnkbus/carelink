import { ScopeScanService } from './scope-scan.service';

/** 03_schema.sql의 restricted_act_keywords 시드 일부. */
const DICT = [
  { keyword: '투약', category: 'MEDICATION' },
  { keyword: '약 먹여', category: 'MEDICATION' },
  { keyword: '인슐린', category: 'INJECTION' },
  { keyword: '석션', category: 'SUCTION' },
  { keyword: '욕창', category: 'WOUND_CARE' },
  { keyword: '혈당 체크', category: 'MEASUREMENT' },
];

function makeService(): ScopeScanService {
  const db = { query: async () => DICT } as never;
  return new ScopeScanService(db);
}

describe('ScopeScanService — 감지는 거부가 아니라 검토 트리거', () => {
  const svc = makeService();

  it('정상 요청은 통과한다', async () => {
    const r = await svc.scan('식사 도움과 보행 보조가 필요합니다');
    expect(r).toMatchObject({ clean: true, action: 'PASS' });
  });

  it('의료행위 키워드를 감지하면 OPS_REVIEW로 보낸다', async () => {
    // 자동 거절하지 않는다. 거절하면 보호자가 표현을 바꿔 우회하고,
    // 그러면 같은 요구가 감지되지 않은 채 간병사에게 전달된다 (§6-15).
    const r = await svc.scan('식사 후 인슐린 주사를 놔주세요');
    expect(r.clean).toBe(false);
    expect(r.action).toBe('OPS_REVIEW');
    expect(r.hits.map((h) => h.keyword)).toContain('인슐린');
  });

  it('공백이 달라도 감지된다', async () => {
    // '약  먹여'처럼 띄어쓰기를 바꾸는 것으로 우회되면 안 된다.
    const r = await svc.scan('아침에 약  먹여  주세요');
    expect(r.hits.map((h) => h.keyword)).toContain('약 먹여');
  });

  it('여러 건이 감지되면 전부 돌려준다', async () => {
    const r = await svc.scan('욕창 소독하고 혈당 체크도 부탁드립니다');
    expect(r.hits).toHaveLength(2);
    expect(r.hits.map((h) => h.category).sort()).toEqual(['MEASUREMENT', 'WOUND_CARE']);
  });

  it('같은 키워드가 여러 번 나오면 위치를 각각 남긴다', async () => {
    // 운영자가 문맥을 보고 판단할 수 있어야 한다.
    const r = await svc.scan('투약 확인, 그리고 투약 시간 기록');
    expect(r.hits.filter((h) => h.keyword === '투약')).toHaveLength(2);
    expect(r.hits[0].index).not.toBe(r.hits[1].index);
  });

  it('빈 입력은 통과다', async () => {
    expect((await svc.scan(null)).clean).toBe(true);
    expect((await svc.scan('')).clean).toBe(true);
  });
});
