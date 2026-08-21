import { TracksService } from './tracks.service';
import type { TracksRepository } from '../repository/tracks.repository';

/**
 * SCR-507 — 버티컬 확장의 실행 창구.
 *
 * 여기서 못 박는 것은 **만드는 것과 여는 것의 분리**입니다. 요건이 갖춰지기
 * 전에 트랙이 열리면 후보자가 아무것도 할 수 없는 트랙에 지원합니다.
 */
function makeService(over: Partial<Record<string, unknown>> = {}) {
  const calls: string[] = [];
  const repo = {
    findTrack: jest.fn().mockResolvedValue({
      id: 't1', industry_id: 'i1', code: 'FARM_WORKER', label_ko: '농작업',
      label_vi: null, qualification_type: 'NONE', visa_types: [],
      is_active: false, sort_order: 0,
    }),
    listRequirements: jest.fn().mockResolvedValue([]),
    setTrackActive: jest.fn(async () => { calls.push('setTrackActive'); return { id: 't1', is_active: true } as never; }),
    createIndustry: jest.fn(async (i: Record<string, unknown>) => ({
      id: 'i9', code: i.code, label_ko: i.labelKo, is_active: false, sort_order: 0,
    })),
    createTrack: jest.fn(async () => ({ id: 't9', is_active: false } as never)),
    replaceRequirements: jest.fn(async () => { calls.push('replaceRequirements'); }),
    replaceWeights: jest.fn(async () => { calls.push('replaceWeights'); }),
    listWeightOverrides: jest.fn().mockResolvedValue([]),
    ...over,
  } as unknown as TracksRepository;
  const audit = { record: jest.fn() } as never;
  return { svc: new TracksService(repo, audit), repo, calls };
}

describe('트랙 공개', () => {
  it('요건이 하나도 없으면 열 수 없다', async () => {
    // 요건 없는 트랙은 '아무나 배치 가능'과 같은 말이고, 그건 이 플랫폼이
    // 파는 것의 반대입니다.
    const { svc, calls } = makeService();
    await expect(svc.setTrackActive('t1', true, 'u1'))
      .rejects.toMatchObject({ code: 'TRACK_NO_REQUIREMENTS' });
    expect(calls).not.toContain('setTrackActive');
  });

  it('요건이 있으면 열린다', async () => {
    const { svc, calls } = makeService({
      listRequirements: jest.fn().mockResolvedValue([{ kind: 'DOCUMENT' }]),
    });
    await svc.setTrackActive('t1', true, 'u1');
    expect(calls).toContain('setTrackActive');
  });

  it('닫을 때는 요건을 보지 않는다 — 잘못 연 트랙을 되돌릴 수 있어야 한다', async () => {
    const { svc, calls } = makeService();
    await svc.setTrackActive('t1', false, 'u1');
    expect(calls).toContain('setTrackActive');
  });
});

describe('산업 · 트랙 생성', () => {
  it('산업은 비활성으로 만들어진다', async () => {
    // 만드는 것과 여는 것은 다른 결정입니다.
    const { svc } = makeService();
    const row = await svc.createIndustry({ code: 'AGRICULTURE', labelKo: '농업', sortOrder: 0, actorUserId: 'u1' });
    expect(row.is_active).toBe(false);
  });

  it('트랙도 비활성으로 만들어진다', async () => {
    const { svc } = makeService();
    const row = await svc.createTrack({
      industryId: 'i1', code: 'FARM_WORKER', labelKo: '농작업',
      labelVi: null, labelEn: null, qualificationType: 'NONE',
      visaTypes: [], sortOrder: 0, actorUserId: 'u1',
    });
    expect(row.is_active).toBe(false);
  });
});

describe('요건과 가중치', () => {
  it('요건은 목록 전체로 교체한다', async () => {
    // 부분 API를 두면 화면 상태와 서버 상태가 어긋나는 경로가 생깁니다.
    const { svc, repo } = makeService();
    await svc.replaceRequirements('t1', [
      { kind: 'DOCUMENT', refCode: 'IDENTITY', isMandatory: true, note: null },
    ], 'u1');
    expect(repo.replaceRequirements).toHaveBeenCalledWith('t1', [
      { kind: 'DOCUMENT', refCode: 'IDENTITY', isMandatory: true, note: null },
    ]);
  });

  it('가중치도 전체 교체다 — 점수는 코드가 아니라 이 표에서 온다 (§5.5)', async () => {
    const { svc, calls } = makeService();
    await svc.replaceWeights('t1', [{ ruleCode: 'REGION', maxPoints: 30 }], 'u1');
    expect(calls).toContain('replaceWeights');
  });

  it('없는 트랙에는 요건을 넣을 수 없다', async () => {
    const { svc } = makeService({ findTrack: jest.fn().mockResolvedValue(null) });
    await expect(svc.replaceRequirements('nope', [], 'u1'))
      .rejects.toMatchObject({ code: 'COMMON_NOT_FOUND' });
  });
});
