import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
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
@Injectable()
export class CareService {
  private readonly log = new Logger(CareService.name);

  constructor(
    private readonly repo: CareRepository,
    private readonly scopeScan: ScopeScanService,
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
