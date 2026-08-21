import { WorkRecordService } from './work-record.service';
import type { AssignmentWorkFacts, WorkRecordRepository } from '../repository/work-record.repository';

/**
 * 근무 기록 집계 (docs/02 §12-12.5).
 *
 * 여기서 못 박는 것은 세 가지입니다.
 *   1. 야간·근무일은 **KST 벽시계** 기준이다 (UTC로 세면 주간이 야간이 된다)
 *   2. 실제 근무가 짧으면 계획된 휴게를 그대로 빼지 않는다 (근로기준법 §54)
 *   3. 24시간 상주는 U5 확정 전까지 집계하지 않는다
 */
function makeService(facts: Partial<AssignmentWorkFacts>) {
  const created: Record<string, unknown>[] = [];
  const repo = {
    assignmentWorkFacts: jest.fn().mockResolvedValue({
      assignment_id: 'a1', worker_user_id: 'u1',
      engagement_id: 'e1', shift_pattern_code: 'H8_3SHIFT',
      started_at: null, ended_at: null, ...facts,
    } as AssignmentWorkFacts),
    findBySource: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (input: Record<string, unknown>) => {
      created.push(input);
      return { id: 'w1', ...input } as never;
    }),
  } as unknown as WorkRecordRepository;
  const audit = { record: jest.fn() } as never;
  return { svc: new WorkRecordService(repo, audit), created };
}

/** KST 벽시계를 UTC Date로. 한국은 서머타임이 없어 고정 -9시간입니다. */
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('근무 시간 구분', () => {
  it('KST 09:00~18:00 주간 근무는 야간이 0분이다', async () => {
    // UTC 시각으로 세면 00:00~09:00이라 00~06시가 야간으로 잡힙니다.
    // 이 테스트가 그 회귀를 막습니다.
    const { svc, created } = makeService({
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-20T18:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({
      workDate: '2026-08-20', breakMinutes: 60, normalMinutes: 480,
      nightMinutes: 0, overtimeMinutes: 0,
    });
  });

  it('야간 교대는 22:00~06:00에 걸친 분만 센다', async () => {
    // KST 20:00~06:00 = 야간 구간 22:00~06:00의 8시간(480분).
    const { svc, created } = makeService({
      shift_pattern_code: 'NIGHT',
      started_at: kst('2026-08-20T20:00:00'),
      ended_at: kst('2026-08-21T06:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({ nightMinutes: 480 });
  });

  it('근무일은 시작 시각의 KST 날짜다', async () => {
    // KST 06:00은 UTC로 전날 21:00입니다. UTC 날짜를 쓰면 근무가 전날로
    // 귀속되고 일별 집계와 휴일 판정이 전부 하루씩 밀립니다.
    const { svc, created } = makeService({
      started_at: kst('2026-08-20T06:00:00'),
      ended_at: kst('2026-08-20T15:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({ workDate: '2026-08-20' });
  });

  it('8시간을 넘는 부분은 연장근로다', async () => {
    // 12시간 체류 - 90분 휴게 = 630분 근무 → 480 소정 + 150 연장.
    const { svc, created } = makeService({
      shift_pattern_code: 'H12_2SHIFT',
      started_at: kst('2026-08-20T08:00:00'),
      ended_at: kst('2026-08-20T20:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({
      breakMinutes: 90, normalMinutes: 480, overtimeMinutes: 150,
    });
  });
});

describe('휴게시간은 실제 근무 길이에 따라 상한이 있다 (근로기준법 §54)', () => {
  it('4시간 미만이면 휴게를 빼지 않는다', async () => {
    // 계획된 60분을 그대로 빼면 2시간 일한 사람의 근로시간이 1시간이 됩니다.
    const { svc, created } = makeService({
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-20T11:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({ breakMinutes: 0, normalMinutes: 120 });
  });

  it('4시간 이상 8시간 미만이면 30분까지만 뺀다', async () => {
    const { svc, created } = makeService({
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-20T15:00:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({ breakMinutes: 30, normalMinutes: 330 });
  });

  it('근로시간이 음수가 되는 경우가 없다', async () => {
    // 체크인 직후 체크아웃 같은 오기록에서도 성립해야 합니다.
    const { svc, created } = makeService({
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-20T09:01:00'),
    });
    await svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null });
    expect(created[0]).toMatchObject({ breakMinutes: 0, normalMinutes: 1 });
  });
});

describe('집계가 막히는 경우', () => {
  it('24시간 상주는 U5 확정 전까지 집계하지 않는다', async () => {
    // 0으로 채우면 '무급 24시간'이 되고 전체를 근로로 넣으면 매일 연장근로
    // 한도를 넘습니다. 둘 다 틀리므로 값을 만들지 않습니다 (CLAUDE.md §6-8).
    const { svc } = makeService({
      shift_pattern_code: 'H24_LIVE_IN',
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-21T09:00:00'),
    });
    await expect(
      svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null }),
    ).rejects.toMatchObject({ code: 'ENGAGEMENT_PAYOUT_UNAVAILABLE' });
  });

  it('활성 배치가 없으면 귀속하지 않는다', async () => {
    // 임의로 만들면 정산이 엉뚱한 계약에 붙습니다.
    const { svc } = makeService({
      engagement_id: null,
      started_at: kst('2026-08-20T09:00:00'),
      ended_at: kst('2026-08-20T18:00:00'),
    });
    await expect(
      svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null }),
    ).rejects.toMatchObject({ code: 'ENGAGEMENT_WORK_RECORD_NO_ENGAGEMENT' });
  });

  it('시작·종료 짝이 없으면 집계하지 않는다', async () => {
    const { svc } = makeService({
      started_at: kst('2026-08-20T09:00:00'), ended_at: null,
    });
    await expect(
      svc.aggregateAssignment({ assignmentId: 'a1', actorUserId: null }),
    ).rejects.toMatchObject({ code: 'ENGAGEMENT_WORK_RECORD_INCOMPLETE' });
  });
});
