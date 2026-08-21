import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { WorkRecordRepository, type WorkRecordRow } from '../repository/work-record.repository';

/**
 * 근무 시간 구분 (근로기준법).
 *
 * 야간은 22:00~06:00입니다 (§56). 이건 시계 계산이라 U5와 무관합니다.
 */
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

/**
 * 한국 표준시 고정 오프셋 (+09:00).
 *
 * 야간·근무일 판정은 전부 **현지 벽시계** 기준입니다. UTC 시각으로 세면
 * KST 09~15시 주간 근무가 UTC 00~06시라 통째로 야간으로 잡히고,
 * 아침 근무는 전날 날짜로 귀속됩니다. 둘 다 정산 분쟁을 만듭니다.
 *
 * 한국은 1988년 이후 서머타임이 없어 오프셋이 고정이라 IANA 타임존 계산이
 * 필요하지 않습니다. 다른 나라로 넓힐 때 바꿀 지점은 여기 하나입니다.
 */
const KST_OFFSET_MINUTES = 9 * 60;

/** UTC 시각을 벽시계로 옮긴다. 이후 getUTC* 가 현지 시·분·일을 돌려준다. */
function toLocal(d: Date): Date {
  return new Date(d.getTime() + KST_OFFSET_MINUTES * 60_000);
}

/**
 * 교대 패턴별 **계획된** 휴게시간 (분).
 *
 * 근로기준법 §54: 4시간 근무 시 30분, 8시간 시 1시간 이상.
 *
 * ── 이 표는 이제 계산에 쓰이지 않습니다 ────────────────────────────────
 * 2026-08-21 결정으로 휴게는 **간병사가 앱에서 찍은 실제 기록**으로 셉니다.
 * 이 표는 "계획이 얼마였는가"를 비교해 어긋난 건을 운영자에게 올리는
 * 용도로만 남습니다.
 *
 * 계획값을 그대로 공제하지 않는 이유는 단순합니다 — **못 쉰 사람의 임금을
 * 빼면 임금체불이고, 그건 소급 청구 대상입니다.** 반대로 기록이 없다고
 * 조용히 넘기면 휴게를 부여했다는 증명이 없어 §54 위반 입증에 방어할 수
 * 없습니다. 그래서 공제는 하지 않되 미기록 사실을 남기고 사람에게 올립니다.
 *
 * **H24_LIVE_IN이 여기 없습니다.** 2026-08-21 결정으로 24시간 상주는
 * `shift_patterns.is_active = false`가 됐습니다. 값이 없으면 집계도 막힙니다 —
 * 비활성 이전에 만들어진 배정이 남아 있을 수 있기 때문입니다.
 */
const PLANNED_BREAK_BY_PATTERN: Record<string, number> = {
  H8_3SHIFT: 60,
  H12_2SHIFT: 90,
  DAY: 60,
  NIGHT: 90,
};

/**
 * 실제 기록이 계획보다 짧아도 **깎지 않습니다.**
 *
 * 여기서 하는 것은 상한 확인뿐입니다 — 기록된 휴게가 실제 체류시간보다
 * 길 수는 없습니다. 그런 기록이 들어오면 오기록이고, 그대로 빼면 근로시간이
 * 음수가 됩니다.
 */
function cap(recorded: number, elapsedMinutes: number): number {
  return Math.max(0, Math.min(recorded, elapsedMinutes));
}

/**
 * service_logs → work_records 집계 (docs/02 §12-12.5).
 *
 * ── 왜 별도 테이블인가 ──────────────────────────────────────────────────
 * `service_logs`는 **버티컬**(care)의 기록이고 `work_records`는 **코어**입니다
 * (§5.14). 어느 산업이든 사람은 일하고 정산되므로, 농업을 붙일 때도
 * `work_records`는 그대로 쓰고 소스만 바뀝니다 — `source_type`이 그 자리입니다.
 *
 * ── U5가 막는 것 ────────────────────────────────────────────────────────
 * 정형 교대(3교대·2교대·주간·야간)는 소정 휴게시간이 법으로 정해져 있어
 * 집계할 수 있습니다. **24시간 상주는 집계하지 않습니다** — 휴게·대기 시간
 * 판정이 U5에 걸려 있고, 임의로 가정하면 나중에 전부 다시 집계해야 합니다.
 */
@Injectable()
export class WorkRecordService {
  private readonly log = new Logger(WorkRecordService.name);

  constructor(
    private readonly repo: WorkRecordRepository,
    private readonly audit: AuditService,
  ) {}

  list(engagementId: string) { return this.repo.listByEngagement(engagementId); }

  /**
   * 완료된 배정을 근무 기록으로 집계합니다.
   *
   * 이미 집계된 배정은 건너뜁니다 — 두 번 돌아도 중복이 생기지 않아야
   * 잡을 안심하고 재실행할 수 있습니다.
   */
  async aggregateAssignment(input: {
    assignmentId: string; actorUserId: string | null;
  }): Promise<WorkRecordRow | null> {
    const source = await this.repo.assignmentWorkFacts(input.assignmentId);
    if (!source) {
      throw new DomainError('COMMON_NOT_FOUND', {
        targetType: 'care_assignment', targetId: input.assignmentId,
      });
    }

    if (!source.started_at || !source.ended_at) {
      throw new DomainError('ENGAGEMENT_WORK_RECORD_INCOMPLETE', {
        assignmentId: input.assignmentId,
        reason: 'the assignment has no SHIFT_START/SHIFT_END pair yet',
      });
    }

    if (!source.engagement_id) {
      // 간병사에게 활성 배치가 없으면 어느 계약에 귀속되는지 알 수 없습니다.
      // 여기서 임의로 만들면 정산이 엉뚱한 계약에 붙습니다.
      throw new DomainError('ENGAGEMENT_WORK_RECORD_NO_ENGAGEMENT', {
        assignmentId: input.assignmentId,
        workerUserId: source.worker_user_id,
        reason: 'no active engagement for this worker; work cannot be attributed',
      });
    }

    // 이미 집계됐으면 그대로 돌려줍니다.
    const existing = await this.repo.findBySource('CARE_ASSIGNMENT', input.assignmentId);
    if (existing) return existing;

    const split = this.splitMinutes({
      startedAt: source.started_at,
      endedAt: source.ended_at,
      shiftPatternCode: source.shift_pattern_code,
      recordedBreakMinutes: source.break_minutes,
    });

    // 휴게 기록이 없는 근무는 조용히 넘어가지 않습니다. 공제는 하지 않되
    // 사실을 남기고 운영자 큐에 올립니다 — 특정 병동에 몰리면 그 현장이
    // 휴게를 못 주고 있다는 신호입니다.
    if (split.breakSource === 'NOT_RECORDED') {
      this.log.warn(
        `work_record: 배정 ${input.assignmentId}에 휴게 기록이 없습니다 — ` +
        '공제하지 않고 운영자 확인 대상으로 둡니다 (§54 이행 증명)',
      );
    }

    const record = await this.repo.create({
      engagementId: source.engagement_id,
      sourceType: 'CARE_ASSIGNMENT',
      sourceId: input.assignmentId,
      // 근무일은 현지 날짜입니다 — 06:00 KST 근무가 전날로 귀속되면 안 됩니다.
      workDate: toLocal(source.started_at).toISOString().slice(0, 10),
      startedAt: source.started_at.toISOString(),
      endedAt: source.ended_at.toISOString(),
      ...split,
    });

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'work_record', targetId: record.id,
      after: {
        sourceType: 'CARE_ASSIGNMENT', sourceId: input.assignmentId,
        shiftPatternCode: source.shift_pattern_code, ...split,
      },
    });
    return record;
  }

  /**
   * 근무 시간 구분.
   *
   * **24시간 상주는 여기서 던집니다.** 휴게시간을 모르면 소정근로시간도
   * 연장근로도 계산할 수 없습니다. 0으로 채우면 "무급 24시간"이 되고,
   * 전체를 근로로 넣으면 매일 연장근로 한도를 넘습니다. 둘 다 틀립니다.
   */
  private splitMinutes(input: {
    startedAt: Date; endedAt: Date; shiftPatternCode: string | null;
    recordedBreakMinutes: number | null;
  }): {
    breakMinutes: number; breakSource: string; normalMinutes: number;
    nightMinutes: number; overtimeMinutes: number; holidayMinutes: number;
  } {
    const pattern = input.shiftPatternCode ?? 'H8_3SHIFT';

    // 비활성 패턴(24시간 상주)은 여전히 집계하지 않습니다. 비활성 이전에
    // 만들어진 배정이 남아 있을 수 있고, 그 건의 근로시간 판정은 U5 그대로입니다.
    if (PLANNED_BREAK_BY_PATTERN[pattern] === undefined) {
      throw new DomainError('ENGAGEMENT_PAYOUT_UNAVAILABLE', {
        shiftPatternCode: pattern,
        blockedBy: ['U5: 24시간 간병의 근로시간 규정 적용 방식 (휴게·대기 시간 판정)'],
        reason:
          'break time for this shift pattern is not determined; ' +
          'aggregating now would have to be redone once U5 is settled',
        reference: 'docs/12 §3 U5 · CLAUDE.md §6-8',
      });
    }

    const elapsed = Math.max(
      0, Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60_000),
    );

    // ── 휴게: 기록된 것만 공제합니다 ────────────────────────────────────
    //
    // 기록이 없으면(null) 0분입니다. 계획된 60분을 대신 빼지 않습니다 —
    // 실제로 못 쉰 사람의 임금을 뺀 것이 되고, 그건 임금체불입니다.
    // 대신 NOT_RECORDED로 남겨 왜 0분인지 되짚을 수 있게 합니다.
    const recorded = input.recordedBreakMinutes;
    const breakSource = recorded === null ? 'NOT_RECORDED' : 'RECORDED';
    const appliedBreak = recorded === null ? 0 : cap(recorded, elapsed);
    const worked = Math.max(0, elapsed - appliedBreak);

    // 야간(22:00~06:00)은 시계 계산입니다. U5와 무관합니다.
    // 휴게를 언제 썼는지는 기록이 없으므로 근무 전 구간에서 셉니다 — 휴게가
    // 야간에 걸렸다면 야간근로가 그만큼 과다 계상됩니다. 휴게 시각을 추측해서
    // 빼는 것보다 과다분을 사람이 정정하는 편이 낫습니다 (correct()가 그 자리).
    const nightMinutes = this.nightMinutesBetween(input.startedAt, input.endedAt);

    // 소정근로시간은 8시간입니다. 이걸 넘는 부분이 연장근로입니다.
    // 3교대·2교대는 소정근로가 확정돼 있어 계산 가능합니다.
    const STANDARD_MINUTES = 8 * 60;
    const overtimeMinutes = Math.max(0, worked - STANDARD_MINUTES);
    const normalMinutes = worked - overtimeMinutes;

    // 휴일근로는 근무일이 휴일인지에 달려 있고, 그건 계약의 소정근로일에서
    // 옵니다. 계약 데이터가 붙기 전까지는 0으로 둡니다 — 추측하지 않습니다.
    const holidayMinutes = 0;

    return {
      breakMinutes: appliedBreak, breakSource,
      normalMinutes, nightMinutes, overtimeMinutes, holidayMinutes,
    };
  }

  /** 22:00~06:00(KST)에 걸친 분. 자정을 넘어가는 근무를 정확히 세야 합니다. */
  private nightMinutesBetween(start: Date, end: Date): number {
    let night = 0;
    const cursor = toLocal(start);
    const localEnd = toLocal(end);
    // 1분 단위로 세는 것이 가장 단순하고 틀리지 않습니다.
    // 교대 근무는 길어야 24시간이라 1440회입니다.
    while (cursor < localEnd) {
      const h = cursor.getUTCHours();
      if (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR) night++;
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    }
    return night;
  }

  /**
   * 근무 기록 승인.
   *
   * 승인 전에는 정산에 들어가지 않습니다. 집계는 자동이지만 확정은 사람이
   * 합니다 — 자동 집계가 틀렸을 때 되돌릴 지점이 필요합니다.
   */
  async approve(id: string, actorUserId: string): Promise<WorkRecordRow> {
    const before = await this.repo.findById(id);
    if (!before) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'work_record', targetId: id });
    }
    if (before.approved_at) return before;

    await this.repo.approve(id, actorUserId);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'work_record', targetId: id,
      after: { approvedBy: actorUserId },
    });
    return (await this.repo.findById(id))!;
  }

  /**
   * 정정.
   *
   * `work_records`도 고치지 않습니다. 정정은 `correction_of`로 새 행입니다 —
   * `service_logs`와 같은 이유이고, 이 둘이 정산 분쟁의 근거 체인입니다 (§5.4).
   */
  async correct(input: {
    originalId: string;
    breakMinutes: number; normalMinutes: number;
    nightMinutes: number; overtimeMinutes: number; holidayMinutes: number;
    actorUserId: string;
  }): Promise<WorkRecordRow> {
    const original = await this.repo.findById(input.originalId);
    if (!original) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'work_record', targetId: input.originalId });
    }

    const record = await this.repo.create({
      engagementId: original.engagement_id,
      sourceType: original.source_type,
      sourceId: original.source_id,
      workDate: original.work_date.toISOString().slice(0, 10),
      startedAt: original.started_at?.toISOString() ?? null,
      endedAt: original.ended_at?.toISOString() ?? null,
      breakMinutes: input.breakMinutes,
      // 정정은 사람이 확인한 값입니다. 앱 기록과 구분합니다.
      breakSource: 'CORRECTED',
      normalMinutes: input.normalMinutes,
      nightMinutes: input.nightMinutes,
      overtimeMinutes: input.overtimeMinutes,
      holidayMinutes: input.holidayMinutes,
      correctionOf: input.originalId,
    });

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'work_record', targetId: record.id,
      before: {
        normalMinutes: original.normal_minutes, nightMinutes: original.night_minutes,
        overtimeMinutes: original.overtime_minutes,
      },
      after: { correctionOf: input.originalId, ...input },
    });
    return record;
  }
}
