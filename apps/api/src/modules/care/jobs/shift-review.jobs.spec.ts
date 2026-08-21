import { Logger } from '@nestjs/common';
import { ShiftReviewJobs } from './shift-review.jobs';
import type { CareRepository } from '../repository/care.repository';
import type { QueueService } from '../../../core/queue/queue.service';

/**
 * 24시간 상주 리포트 (docs/07 §5·§7).
 *
 * 알림 잡이 아니라 관찰 잡입니다. 그래서 검증할 것은 "무엇을 사람 눈에
 * 띄게 하는가"입니다.
 */
function makeJob(snapshot: Record<string, string> | null, workers: unknown[] = []) {
  const logs = { error: [] as string[], warn: [] as string[], log: [] as string[] };
  const repo = {
    liveInSnapshot: jest.fn().mockResolvedValue(snapshot),
    liveInWorkers: jest.fn().mockResolvedValue(workers),
  } as unknown as CareRepository;
  const queue = { register: jest.fn() } as unknown as QueueService;
  const job = new ShiftReviewJobs(queue, repo);

  jest.spyOn(Logger.prototype, 'error').mockImplementation((m) => { logs.error.push(String(m)); });
  jest.spyOn(Logger.prototype, 'warn').mockImplementation((m) => { logs.warn.push(String(m)); });
  jest.spyOn(Logger.prototype, 'log').mockImplementation((m) => { logs.log.push(String(m)); });
  return { job, logs };
}

afterEach(() => jest.restoreAllMocks());

const snap = (over: Record<string, string> = {}) => ({
  live_in: '0', total: '10', unapproved: '0', direct_employment: '0', ...over,
});

describe('24시간 상주 리포트', () => {
  it('배정이 없으면 아무것도 보고하지 않는다', async () => {
    // 0/0을 비율로 만들면 NaN이 로그에 찍힙니다.
    const { job, logs } = makeJob(snap({ total: '0' }));
    const r = await job.review();
    expect(r.scanned).toBe(0);
    expect(logs.log).toHaveLength(0);
  });

  it('건수가 아니라 비율을 보고한다', async () => {
    // 건수만 보면 전체가 늘어난 것인지 24시간이 늘어난 것인지 모릅니다.
    const { job, logs } = makeJob(snap({ live_in: '3', total: '12' }));
    await job.review();
    expect(logs.log[0]).toContain('3/12');
    expect(logs.log[0]).toContain('25%');
  });

  it('승인 없이 진행 중인 24시간은 ERROR다 — 게이트가 뚫린 것이다', async () => {
    const { job, logs } = makeJob(snap({ live_in: '2', unapproved: '2' }));
    await job.review();
    expect(logs.error.join()).toContain('승인 없이');
  });

  it('직접고용 인력의 24시간 배정은 ERROR다 (§5.12)', async () => {
    // 모델 전환으로 사후에 생길 수 있습니다 — 생성 시점 게이트만으로는
    // 잡히지 않아서 리포트가 필요합니다.
    const { job, logs } = makeJob(snap({ live_in: '1', direct_employment: '1' }));
    await job.review();
    expect(logs.error.join()).toContain('직접고용');
    expect(logs.error.join()).toContain('U5');
  });

  it('한 사람이 오래 붙어 있으면 그 사람을 지목한다', async () => {
    // 총량이 같아도 열 명이 열흘씩과 한 명이 백일은 전혀 다른 상태입니다.
    const { job, logs } = makeJob(snap({ live_in: '1' }), [
      { caregiver_id: 'c1', display_code: 'CG-001', user_id: 'u1', assignments: '1', since: new Date(), days: '95' },
      { caregiver_id: 'c2', display_code: 'CG-002', user_id: 'u2', assignments: '1', since: new Date(), days: '3' },
    ]);
    const r = await job.review();
    expect(logs.warn.join()).toContain('CG-001');
    expect(logs.warn.join()).not.toContain('CG-002');
    expect(r.skipped).toBe(1);
  });

  it('모두 정상이면 사람이 볼 것이 0이다', async () => {
    const { job } = makeJob(snap({ live_in: '1' }));
    const r = await job.review();
    expect(r.skipped).toBe(0);
  });
});
