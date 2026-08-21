import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { EngagementService } from '../../engagement/service/engagement.service';
import { ClearanceService } from '../../quality/service/clearance.service';
import { ScopeScanService } from '../../quality/service/scope-scan.service';
import {
  CareRepository, type CareAssignmentRow, type CareRequestRow, type CaregiverFactsRow,
} from '../repository/care.repository';
import {
  assignmentMachine, careRequestMachine, CARE_ASSIGNMENT_SLA_HOURS,
  type AssignmentStatus, type CareRequestStatus,
} from '../state/care.state';

/** 보호자에게 나가는 간병사 카드. 국적이 **없습니다** (§6-21). */
export interface CaregiverCard {
  caregiverId: string;
  displayCode: string;
  experienceYrs: number;
  ratingAvg: number | null;
  completedCount: number;
  available: boolean;
}

/**
 * care — 간병 요청·배정 (docs/02 §4 · V2).
 *
 * **버티컬 모듈입니다.** 여기의 개념(간병 요청, 병실, 보호자)을 코어로
 * 올리지 마세요 — 농업을 붙일 때 전면 재작업이 됩니다 (§5.14).
 * 반대로 engagement·work_records·billing_lines는 코어에 있어야 합니다.
 */
/** QR 체크인에서만 생기는 로그 유형. 정정은 되지만 생성은 안 됩니다. */
const SHIFT_LOG_TYPES = new Set(['SHIFT_START', 'SHIFT_END']);

@Injectable()
export class CareService {
  private readonly log = new Logger(CareService.name);

  constructor(
    private readonly repo: CareRepository,
    private readonly scopeScan: ScopeScanService,
    private readonly engagements: EngagementService,
    private readonly clearances: ClearanceService,
    private readonly audit: AuditService,
  ) {}

  listServiceItems() { return this.repo.listServiceItems(); }
  listHospitals() { return this.repo.listHospitals(); }
  listRequests(filter: Parameters<CareRepository['listRequests']>[0]) { return this.repo.listRequests(filter); }
  listAssignments(careRequestId: string) { return this.repo.listAssignments(careRequestId); }

  async getRequest(id: string): Promise<CareRequestRow> {
    const row = await this.repo.findRequest(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'care_request', targetId: id });
    return row;
  }

  /**
   * 간병 요청 생성 (SCR-303).
   *
   * ── 업무범위 스캔 ────────────────────────────────────────────────────
   * 자유 입력(`cautions`)을 `restricted_act_keywords`로 스캔합니다.
   * **감지는 거절이 아니라 검토 트리거입니다** (§6-15). 자동 거절하면 보호자가
   * 표현을 바꿔 우회하고, 그러면 같은 요구가 감지되지 않은 채 간병사에게
   * 전달됩니다. 사람이 개입해 "그건 의료행위라 할 수 없습니다"를 설명하는 것이
   * 목적이므로 `OPS_REVIEW`로 보냅니다.
   *
   * 정형 항목(`care_service_items`)에는 애초에 의료행위가 없습니다 (§6-2).
   * 그래서 스캔 대상은 자유 입력뿐입니다.
   *
   * ── 교대 패턴 ────────────────────────────────────────────────────────
   * 기본값은 3교대입니다. `H24_LIVE_IN`은 `requires_approval`이라 운영자
   * 승인 전에는 배정되지 않습니다 (§5.12) — 잠을 못 자는 사람에게 품질을
   * 요구할 수 없고, 24시간 상주를 유지하면 나머지 통제 장치도 무너집니다.
   */
  async createRequest(input: {
    requesterId: string; organizationId: string | null; hospitalId: string | null;
    ward: string | null; serviceType: string; shiftPatternCode: string | null;
    startAt: string; endAt: string | null; supportItems: string[];
    mobilityLevel: string | null; cautions: string | null;
  }): Promise<{ request: CareRequestRow; scanHits: { keyword: string; category: string }[] }> {
    // 카탈로그에 없는 항목은 받지 않습니다. 클라이언트가 임의 코드를 넣어
    // 의료행위를 정형 항목처럼 통과시키는 경로를 막습니다.
    const catalog = new Set((await this.repo.listServiceItems()).map((i) => i.code));
    const unknown = input.supportItems.filter((c) => !catalog.has(c));
    if (unknown.length > 0) {
      throw new DomainError('CARE_UNKNOWN_SERVICE_ITEM', {
        unknown,
        reason: 'service items must come from the catalog; medical acts are not in it by design',
      });
    }

    const scan = await this.scopeScan.scan(input.cautions);
    const flags = scan.hits.map((h) => h.category);

    // 감지되면 매칭 전에 사람이 본다. 거절이 아니다.
    const status: CareRequestStatus = scan.clean ? 'SUBMITTED' : 'OPS_REVIEW';

    const request = await this.repo.createRequest({
      ...input,
      shiftPatternCode: input.shiftPatternCode ?? 'H8_3SHIFT',
      restrictedFlags: [...new Set(flags)],
      status,
      slaHours: CARE_ASSIGNMENT_SLA_HOURS,
    });

    await this.audit.record({
      actorUserId: input.requesterId, action: 'STATUS_CHANGE',
      targetType: 'care_request', targetId: request.id,
      after: { status, restrictedFlags: request.restricted_flags, scanHits: scan.hits.length },
    });

    if (!scan.clean) {
      this.log.warn(
        `care_request ${request.id}: 업무범위 키워드 ${scan.hits.length}건 → OPS_REVIEW ` +
        `(${scan.hits.map((h) => h.keyword).join(', ')})`,
      );
    }

    return { request, scanHits: scan.hits.map((h) => ({ keyword: h.keyword, category: h.category })) };
  }

  async changeRequestStatus(
    id: string, to: CareRequestStatus, actorUserId: string,
  ): Promise<CareRequestRow> {
    const before = await this.getRequest(id);
    careRequestMachine.assert(before.status, to);

    // 매칭으로 보내기 전에 교대 패턴 승인을 확인합니다.
    if (to === 'MATCHING') await this.assertShiftPatternAllowed(before);

    await this.repo.setRequestStatus(id, to);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'care_request', targetId: id,
      before: { status: before.status }, after: { status: to },
    });
    return this.getRequest(id);
  }

  /**
   * 24시간 상주는 운영자 승인 없이 매칭에 들어가지 않습니다 (§5.12).
   *
   * 기본값을 3교대로 두는 것만으로는 부족합니다 — 보호자가 24시간을 고르는
   * 것 자체는 막지 않되, 사람이 한 번 보게 만듭니다.
   */
  private async assertShiftPatternAllowed(request: CareRequestRow): Promise<void> {
    const code = request.shift_pattern_code;
    if (!code) return;
    const pattern = await this.repo.findShiftPattern(code);
    if (!pattern?.requires_approval) return;
    if (request.shift_approved_by) return;

    throw new DomainError('QUALITY_SHIFT_NEEDS_APPROVAL', {
      careRequestId: request.id,
      shiftPatternCode: code,
      label: pattern.label_ko,
      reason: 'this shift pattern requires operator approval before matching',
    });
  }

  /**
   * 직접고용 인력에게는 24시간 상주를 배정하지 않습니다 (§5.12).
   *
   * 요청 단위 승인(`assertShiftPatternAllowed`)은 **누가 갈지 정해지기 전**에
   * 이뤄집니다. 그래서 인력별 판단은 여기서 다시 해야 합니다 — 운영자가
   * 24시간을 승인했다는 사실이 직접고용 인력에게 배정해도 된다는 뜻은
   * 아닙니다.
   *
   * 근로시간 규정 적용 방식(U5)이 정해지기 전까지, 직접고용 인력의 24시간
   * 근무는 연장·야간 한도를 넘는지 계산할 수 없습니다. 계산할 수 없는 근무를
   * 시키면 나중에 소급해서 위법이 됩니다.
   */
  private async assertShiftPatternAllowedForWorker(
    request: CareRequestRow, caregiverId: string,
  ): Promise<void> {
    const code = request.shift_pattern_code;
    if (!code) return;
    const pattern = await this.repo.findShiftPattern(code);
    if (!pattern?.requires_approval) return;

    const workerUserId = await this.repo.caregiverUserId(caregiverId);
    if (!workerUserId) return;

    const model = await this.engagements.activeModel(workerUserId);
    if (model !== 'DIRECT_EMPLOYMENT') return;

    throw new DomainError('QUALITY_SHIFT_NOT_ALLOWED_FOR_WORKER', {
      careRequestId: request.id,
      shiftPatternCode: code,
      engagementModel: model,
      blockedBy: ['U5: 24시간 간병의 근로시간 규정 적용 방식'],
      reason:
        'direct-employment workers cannot be placed on 24-hour live-in shifts ' +
        'until the working-time rules are settled',
      reference: 'CLAUDE.md §5.12 · docs/07 §4',
    });
  }

  async approveShiftPattern(id: string, actorUserId: string): Promise<CareRequestRow> {
    const before = await this.getRequest(id);
    await this.repo.approveShiftPattern(id, actorUserId);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'care_request', targetId: id,
      before: { shiftApprovedBy: before.shift_approved_by },
      after: { shiftApprovedBy: actorUserId, shiftPatternCode: before.shift_pattern_code },
    });
    return this.getRequest(id);
  }

  /**
   * 간병사 후보 (SCR-304).
   *
   * **국적이 나가지 않습니다** (§6-21, 2026-08-21 확정). 보호자가 국적으로
   * 간병사를 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한 인력이
   * 국적 때문에 선택받지 못합니다. 카드에는 경력·자격·평점만 담습니다.
   *
   * 클리어런스 6종이 전부 PASS인 사람만 나옵니다 (§5.11). 예외 경로는 없습니다.
   */
  async matchCaregivers(careRequestId: string): Promise<{
    candidates: CaregiverCard[];
    excludedCount: number;
    excludedReasons: Record<string, number>;
  }> {
    const request = await this.getRequest(careRequestId);
    const facts = await this.repo.caregiverCandidates(
      request.start_at.toISOString(),
      request.end_at?.toISOString() ?? null,
    );

    // 클리어런스는 사람 단위입니다. 한 번에 조회해 N+1을 피합니다.
    const readiness = await this.clearances.readinessByWorker(facts.map((f) => f.user_id));

    const excludedReasons: Record<string, number> = {};
    const bump = (k: string) => { excludedReasons[k] = (excludedReasons[k] ?? 0) + 1; };

    const candidates: CaregiverCard[] = [];
    for (const f of facts) {
      const ready = readiness.get(f.user_id);
      if (!ready?.ready) {
        bump(ready && ready.expired.length > 0 ? 'CLEARANCE_EXPIRED' : 'CLEARANCE_INCOMPLETE');
        continue;
      }
      if (!f.available) { bump('NOT_AVAILABLE'); continue; }
      candidates.push(toCard(f));
    }

    return {
      candidates,
      excludedCount: facts.length - candidates.length,
      excludedReasons,
    };
  }

  /**
   * 배정 제안 (SCR-304 1단계).
   *
   * 보호자가 고른 간병사에게 제안을 보냅니다. **아직 확정이 아닙니다.**
   */
  async offerAssignment(input: {
    careRequestId: string; caregiverId: string;
    shiftStartTime: string | null; shiftEndTime: string | null; actorUserId: string;
  }): Promise<CareAssignmentRow> {
    const request = await this.getRequest(input.careRequestId);
    await this.assertShiftPatternAllowed(request);
    await this.assertShiftPatternAllowedForWorker(request, input.caregiverId);

    if (request.status !== 'MATCHING') {
      careRequestMachine.assert(request.status, 'MATCHING');
    }

    const assignment = await this.repo.createAssignment(input);
    await this.repo.setRequestStatus(input.careRequestId, 'OFFER_SENT');
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'care_assignment', targetId: assignment.id,
      after: { status: 'OFFERED', careRequestId: input.careRequestId, caregiverId: input.caregiverId },
    });
    return assignment;
  }

  /**
   * 배정 상태 전이 (SCR-304 2·3단계).
   *
   * **확정은 3단계입니다** (§6-4):
   *   보호자 선택 → 간병사 수락(ACCEPTED) → **운영자 확인(ASSIGNED)**
   *
   * 간병사 수락만으로 확정되지 않습니다. 즉시 자동 확정은 노쇼와 조건 불일치를
   * 그대로 통과시킵니다. 자동화는 취소율이 안정된 뒤에 엽니다.
   */
  async transitionAssignment(input: {
    assignmentId: string; to: AssignmentStatus; actorUserId: string;
    isOperator: boolean;
  }): Promise<CareAssignmentRow> {
    const before = await this.repo.findAssignment(input.assignmentId);
    if (!before) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'care_assignment', targetId: input.assignmentId });
    }
    assignmentMachine.assert(before.status, input.to);

    // ASSIGNED는 운영자만 만들 수 있습니다. 이 게이트가 3단계의 3단계입니다.
    if (input.to === 'ASSIGNED' && !input.isOperator) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'only an operator can confirm an assignment; caregiver acceptance is not confirmation',
      });
    }

    await this.repo.setAssignmentStatus(
      input.assignmentId, input.to, input.to === 'ASSIGNED' ? input.actorUserId : null,
    );

    // 요청 상태를 따라 올립니다.
    const request = await this.getRequest(before.care_request_id);
    if (input.to === 'ASSIGNED' && request.status !== 'ASSIGNED') {
      careRequestMachine.assert(request.status, 'ASSIGNED');
      await this.repo.setRequestStatus(request.id, 'ASSIGNED');
    }
    // 거절되면 다시 매칭으로 돌립니다 — 보호자가 다른 간병사를 고를 수 있어야 합니다.
    if (input.to === 'DECLINED' && request.status === 'OFFER_SENT') {
      await this.repo.setRequestStatus(request.id, 'MATCHING');
    }

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'care_assignment', targetId: input.assignmentId,
      before: { status: before.status }, after: { status: input.to },
    });
    return (await this.repo.findAssignment(input.assignmentId))!;
  }

  overdueRequests() { return this.repo.overdueRequests(); }

  // ── 근무 기록 (SCR-403 · 404 · 306) ───────────────────────────────────

  /**
   * 간병사용 근무 상세 (SCR-403).
   *
   * **환자 실명·진단명이 나가지 않습니다.** 리포지토리 쿼리에 아예 없습니다 —
   * "이 원칙을 API scope 레벨에서 강제해야 합니다"(SCR-403 notes)는 화면에서
   * 가리라는 뜻이 아니라 데이터가 나가지 않게 하라는 뜻입니다.
   *
   * 간병사가 알아야 하는 것은 **어디서 무엇을 하는가**입니다:
   * 병원·병실·교대 시간·필요 지원·주의사항.
   */
  async caregiverView(assignmentId: string, userId: string, isOperator: boolean) {
    if (!isOperator && !(await this.repo.isAssignedCaregiver(assignmentId, userId))) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'only the assigned caregiver can view this assignment',
      });
    }
    const view = await this.repo.caregiverAssignmentView(assignmentId);
    if (!view) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'care_assignment', targetId: assignmentId });
    }
    return view;
  }

  assignmentsForCaregiver(userId: string) { return this.repo.assignmentsForCaregiver(userId); }

  listServiceLogs(assignmentId: string) { return this.repo.listServiceLogs(assignmentId); }
  requesterOfAssignment(assignmentId: string) { return this.repo.requesterOfAssignment(assignmentId); }

  async getAssignment(assignmentId: string) {
    const row = await this.repo.findAssignment(assignmentId);
    if (!row) {
      throw new DomainError('COMMON_NOT_FOUND', {
        targetType: 'care_assignment', targetId: assignmentId,
      });
    }
    return row;
  }

  /**
   * 근무 시작·종료 (SCR-404).
   *
   * ── 체크 방법 ────────────────────────────────────────────────────────
   * 기본은 **병실 QR**입니다. GPS는 위치정보 수집·이용 동의와 법규 검토가
   * 선행돼야 하므로 기본 경로로 두지 않습니다 (§6-3). QR은 동의 부담이 낮고
   * 정확도도 높습니다.
   *
   * `MANUAL`은 QR이 고장 났을 때의 예외입니다. 허용하되 **기록에 남깁니다** —
   * 나중에 분쟁이 나면 어떤 방법으로 찍었는지가 근거의 무게를 정합니다.
   *
   * ── append-only ──────────────────────────────────────────────────────
   * 시작·종료도 로그 한 행입니다. 배정 상태는 따라 움직이지만 로그 자체는
   * 고치지 않습니다 (§5.4).
   */
  async recordShiftBoundary(input: {
    assignmentId: string; boundary: 'START' | 'END';
    checkMethod: 'QR' | 'GPS' | 'MANUAL'; qrToken: string | null;
    geoPoint: unknown | null; memo: string | null;
    actorUserId: string; isOperator: boolean;
  }) {
    if (!input.isOperator && !(await this.repo.isAssignedCaregiver(input.assignmentId, input.actorUserId))) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'only the assigned caregiver can record work for this assignment',
      });
    }

    const assignment = await this.repo.findAssignment(input.assignmentId);
    if (!assignment) {
      throw new DomainError('COMMON_NOT_FOUND', { targetType: 'care_assignment', targetId: input.assignmentId });
    }

    // QR로 찍는다면 토큰이 병실과 맞아야 합니다. 토큰 없이 QR이라고 주장하는
    // 요청은 사실상 MANUAL이므로 거부합니다 — 방법을 속이면 근거가 무너집니다.
    if (input.checkMethod === 'QR' && !input.qrToken) {
      throw new DomainError('CARE_QR_TOKEN_REQUIRED', {
        reason: 'QR check-in requires the room token; use MANUAL if the code cannot be scanned',
      });
    }
    if (input.checkMethod === 'QR') {
      await this.assertQrTokenMatches(assignment.care_request_id, input.qrToken!);
    }

    const to = input.boundary === 'START' ? 'IN_SERVICE' : 'COMPLETED';
    assignmentMachine.assert(assignment.status, to as AssignmentStatus);

    const log = await this.repo.appendServiceLog({
      assignmentId: input.assignmentId,
      logType: input.boundary === 'START' ? 'SHIFT_START' : 'SHIFT_END',
      itemCode: null,
      occurredAt: new Date().toISOString(),
      checkMethod: input.checkMethod,
      // GPS 좌표는 동의가 있을 때만 들어옵니다. 없으면 NULL입니다.
      geoPoint: input.checkMethod === 'GPS' ? input.geoPoint : null,
      memo: input.memo,
      correctionOf: null,
      createdBy: input.actorUserId,
    });

    await this.repo.setAssignmentStatus(input.assignmentId, to as AssignmentStatus, null);

    // 요청 상태도 따라 올립니다.
    const request = await this.getRequest(assignment.care_request_id);
    const requestTo: CareRequestStatus = input.boundary === 'START' ? 'IN_SERVICE' : 'COMPLETED';
    if (request.status !== requestTo && careRequestMachine.can(request.status, requestTo)) {
      await this.repo.setRequestStatus(request.id, requestTo);
    }

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'service_log', targetId: log.id,
      after: { logType: log.log_type, checkMethod: input.checkMethod, assignmentId: input.assignmentId },
    });
    return log;
  }

  /**
   * 병실 QR 토큰 검증.
   *
   * 토큰은 `병원ID:병실` 형태입니다. 다른 병실 QR로 찍으면 근무지가 아닌
   * 곳에서 출근 처리되므로 막습니다.
   *
   * 실제 운영에서는 서명·만료가 붙어야 합니다. 지금은 병실 일치까지만 봅니다 —
   * 서명 키 관리 방식이 정해지지 않았고, 임의로 정하면 나중에 전부 재발급해야
   * 합니다. 그때까지는 이 검사가 최소선입니다.
   */
  private async assertQrTokenMatches(careRequestId: string, token: string): Promise<void> {
    const request = await this.getRequest(careRequestId);
    const expected = `${request.hospital_id ?? ''}:${request.ward ?? ''}`;
    if (token !== expected) {
      throw new DomainError('CARE_QR_TOKEN_MISMATCH', {
        reason: 'this QR code belongs to a different room',
        // 기대값을 응답에 넣지 않습니다 — 넣으면 아무 데서나 위조할 수 있습니다.
      });
    }
  }

  /**
   * 서비스 기록 추가 (SCR-404 · 306).
   *
   * `item_code`는 카탈로그에서 옵니다 — 의료행위가 기록으로 들어오는 경로를
   * 막습니다 (§6-2). 서술형은 `memo` 하나뿐이고 보호자에게는 정형 항목만
   * 나갑니다 (SCR-306 notes: 의료기록과 혼동될 수 있음).
   */
  async appendLog(input: {
    assignmentId: string; logType: string; itemCode: string | null;
    memo: string | null; correctionOf: string | null; occurredAt: string | null;
    actorUserId: string; isOperator: boolean;
  }) {
    if (!input.isOperator && !(await this.repo.isAssignedCaregiver(input.assignmentId, input.actorUserId))) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'only the assigned caregiver can record work for this assignment',
      });
    }

    if (input.itemCode) {
      const catalog = new Set((await this.repo.listServiceItems()).map((i) => i.code));
      if (!catalog.has(input.itemCode)) {
        throw new DomainError('CARE_UNKNOWN_SERVICE_ITEM', {
          itemCode: input.itemCode,
          reason: 'log items must come from the catalog; medical acts are not in it by design',
        });
      }
    }

    // 정정 대상이 있으면 같은 배정의 기록인지 확인합니다.
    let original: Awaited<ReturnType<typeof this.repo.findServiceLog>> = null;
    if (input.correctionOf) {
      original = await this.repo.findServiceLog(input.correctionOf);
      if (!original || original.assignment_id !== input.assignmentId) {
        throw new DomainError('COMMON_NOT_FOUND', {
          targetType: 'service_log', targetId: input.correctionOf,
          reason: 'correction target must belong to the same assignment',
        });
      }
      // 정정은 원본과 같은 유형이어야 합니다. 유형을 바꿀 수 있으면
      // 메모 한 줄이 출퇴근 기록으로 둔갑합니다.
      if (original.log_type !== input.logType) {
        throw new DomainError('CARE_LOG_IMMUTABLE', {
          logType: input.logType, originalLogType: original.log_type,
          reason: 'a correction must restate the same kind of event as the original',
        });
      }
    }

    // 출퇴근은 QR 체크인에서만 생깁니다 (§6-3). 여기서는 정정만 됩니다 —
    // 새로 만들 수 있으면 QR을 찍지 않고 근무를 주장할 수 있습니다.
    if (SHIFT_LOG_TYPES.has(input.logType) && !input.correctionOf) {
      throw new DomainError('CARE_LOG_IMMUTABLE', {
        logType: input.logType,
        reason: 'shift boundaries are created by QR check-in only; this endpoint can correct one but not create it',
      });
    }

    // 시각을 다시 적는 것은 정정이고, 정정은 운영자가 확인한 결과입니다.
    // 이 게이트가 없으면 QR 체크인 시각이 아무 의미도 갖지 못합니다.
    if (input.occurredAt) {
      if (!input.isOperator || !input.correctionOf) {
        throw new DomainError('CARE_LOG_TIME_FORBIDDEN', {
          reason: 'restating the time of an event is a correction, and corrections are confirmed by an operator',
        });
      }
      if (new Date(input.occurredAt).getTime() > Date.now()) {
        throw new DomainError('CARE_LOG_TIME_INVALID', {
          occurredAt: input.occurredAt,
          reason: 'a shift cannot be logged before it happens',
        });
      }
    }

    const log = await this.repo.appendServiceLog({
      assignmentId: input.assignmentId,
      logType: input.logType,
      itemCode: input.itemCode,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      checkMethod: null,
      geoPoint: null,
      memo: input.memo,
      correctionOf: input.correctionOf,
      createdBy: input.actorUserId,
    });

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'service_log', targetId: log.id,
      after: {
        logType: log.log_type, itemCode: log.item_code,
        correctionOf: log.correction_of, occurredAt: log.occurred_at,
      },
    });
    return log;
  }
}

function toCard(f: CaregiverFactsRow): CaregiverCard {
  return {
    caregiverId: f.caregiver_id,
    displayCode: f.display_code,
    experienceYrs: f.experience_yrs,
    ratingAvg: f.rating_avg,
    completedCount: f.completed_count,
    available: f.available,
    // nationality를 여기에 추가하지 마세요 (§6-21).
  };
}
