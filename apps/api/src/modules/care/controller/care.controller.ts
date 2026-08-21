import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  AppendLogDto, AssignmentStatusDto, AvailabilityDto, AvailabilityInputDto,
  CareAssignmentDto, CaregiverAssignmentDto,
  CareMatchResultDto, CareRequestDto, CareRequestQueryDto, CareRequestStatusDto,
  CaregiverCardDto, CreateCareRequestDto, OfferAssignmentDto, ServiceLogDto,
  ShiftBoundaryDto,
} from '../dto/care.dto';
import type {
  CareAssignmentRow, CareRequestRow, ServiceLogRow,
} from '../repository/care.repository';
import { CareService } from '../service/care.service';

/** SCR-303 간병 신청 · SCR-304 간병사 매칭 · SCR-505 간병 운영 */
@Controller()
export class CareController {
  constructor(private readonly care: CareService) {}

  /** 서비스 카탈로그. **의료행위 항목은 여기 존재하지 않습니다** (§6-2). */
  @Get('care-services/catalog')
  async catalog(): Promise<{ code: string; labelKo: string }[]> {
    return (await this.care.listServiceItems()).map((i) => ({ code: i.code, labelKo: i.label_ko }));
  }

  /**
   * 신청 가능한 병원 (SCR-302).
   *
   * 제휴 병원이면서 **배정 가능한 간병사가 있는** 곳만 내려갑니다.
   * 커버리지를 넓히려고 공급 없는 병원을 열면 신청은 들어오고 배정은 안 되며,
   * 그 신청은 전부 취소로 끝납니다. 취소를 겪은 보호자는 돌아오지 않습니다.
   */
  @Get('care-hospitals')
  async hospitals(): Promise<{ id: string; name: string; region: string | null; activeCaregivers: number }[]> {
    return (await this.care.listHospitals())
      .map((h) => ({
        id: h.id, name: h.name, region: h.region, activeCaregivers: Number(h.active_caregivers),
      }))
      .filter((h) => h.activeCaregivers > 0);
  }

  /** POST /api/v1/care-requests — SCR-303 */
  @Post('care-requests')
  async create(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: CreateCareRequestDto,
  ): Promise<CareRequestDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const { request } = await this.care.createRequest({
      requesterId: viewer.userId,
      organizationId: dto.organizationId ?? null,
      hospitalId: dto.hospitalId ?? null,
      ward: dto.ward ?? null,
      serviceType: dto.serviceType,
      shiftPatternCode: dto.shiftPatternCode ?? null,
      startAt: dto.startAt,
      endAt: dto.endAt ?? null,
      supportItems: dto.supportItems ?? [],
      mobilityLevel: dto.mobilityLevel ?? null,
      cautions: dto.cautions ?? null,
    });
    return toRequestDto(request);
  }

  @Get('care-requests/:id')
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<CareRequestDto> {
    return toRequestDto(await this.care.getRequest(id));
  }

  /** SCR-505 칸반. 상태별로 묶어 보여줍니다. */
  @Get('admin/care-requests')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async board(@Query() q: CareRequestQueryDto): Promise<CareRequestDto[]> {
    return (await this.care.listRequests({ status: q.status })).map(toRequestDto);
  }

  @Get('care-requests/me/list')
  async mine(@CurrentViewer() viewer: Viewer): Promise<CareRequestDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    return (await this.care.listRequests({ requesterId: viewer.userId })).map(toRequestDto);
  }

  @Patch('care-requests/:id/status')
  async changeStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CareRequestStatusDto,
  ): Promise<CareRequestDto> {
    return toRequestDto(await this.care.changeRequestStatus(id, dto.status, viewer.userId!));
  }

  /**
   * 24시간 상주 승인 (§5.12).
   *
   * 운영자만 할 수 있습니다. 승인 없이는 매칭에 들어가지 않습니다 —
   * 잠을 못 자는 사람에게 품질을 요구할 수 없고, 24시간 상주를 유지하면
   * 나머지 통제 장치도 결국 무너집니다.
   */
  @Post('care-requests/:id/approve-shift')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async approveShift(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CareRequestDto> {
    return toRequestDto(await this.care.approveShiftPattern(id, viewer.userId!));
  }

  /**
   * POST /api/v1/care-requests/{id}/match — SCR-304
   *
   * 카드에 국적이 없습니다 (§6-21). 클리어런스 6종 미완인 간병사는 나오지
   * 않고, 제외 건수는 사유와 함께 돌려줍니다.
   */
  @Post('care-requests/:id/match')
  async match(@Param('id', ParseUUIDPipe) id: string): Promise<CareMatchResultDto> {
    const request = await this.care.getRequest(id);
    const result = await this.care.matchCaregivers(id);
    return Object.assign(new CareMatchResultDto(), {
      ownerUserId: request.requester_id,
      candidates: result.candidates.map((c) => Object.assign(new CaregiverCardDto(), c)),
      excludedCount: result.excludedCount,
      excludedReasons: result.excludedReasons,
    });
  }

  /** 1단계 — 보호자가 고른 간병사에게 제안. 아직 확정이 아닙니다. */
  @Post('care-requests/:id/assign')
  async offer(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferAssignmentDto,
  ): Promise<CareAssignmentDto> {
    const row = await this.care.offerAssignment({
      careRequestId: id, caregiverId: dto.caregiverId,
      shiftStartTime: dto.shiftStartTime ?? null,
      shiftEndTime: dto.shiftEndTime ?? null,
      actorUserId: viewer.userId!,
    });
    const request = await this.care.getRequest(id);
    return toAssignmentDto(row, request.requester_id);
  }

  @Get('care-requests/:id/assignments')
  async assignments(@Param('id', ParseUUIDPipe) id: string): Promise<CareAssignmentDto[]> {
    const request = await this.care.getRequest(id);
    const rows = await this.care.listAssignments(id);
    return rows.map((r) => toAssignmentDto(r, request.requester_id));
  }

  /**
   * SCR-306 — 배정 한 건.
   *
   * 보호자가 진행 상황 화면에서 씁니다. `self`는 역할이 아니라 관계라
   * (요청의 신청자 === 나) 소유자 판정은 직렬화 단계가 합니다 — 여기서
   * if 문으로 거르지 않습니다 (§5.2).
   */
  @Get('care-assignments/:id')
  async assignment(@Param('id', ParseUUIDPipe) id: string): Promise<CareAssignmentDto> {
    const row = await this.care.getAssignment(id);
    const request = await this.care.getRequest(row.care_request_id);
    return toAssignmentDto(row, request.requester_id);
  }

  /**
   * 2·3단계 — 간병사 수락(ACCEPTED) → 운영자 확인(ASSIGNED).
   *
   * `ASSIGNED`는 운영자만 만들 수 있습니다. 수락은 확정이 아닙니다 (§6-4).
   */
  @Patch('care-assignments/:id/status')
  async transition(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignmentStatusDto,
  ): Promise<CareAssignmentDto> {
    const isOperator = viewer.scopes.includes('admin');
    const row = await this.care.transitionAssignment({
      assignmentId: id, to: dto.status, actorUserId: viewer.userId!, isOperator,
    });
    const request = await this.care.getRequest(row.care_request_id);
    return toAssignmentDto(row, request.requester_id);
  }

  // ── 근무 기록 (SCR-401 · 403 · 404 · 306) ───────────────────────────────

  /** SCR-401·402 — 간병사 본인의 배정 목록. */
  @Get('caregivers/me/assignments')
  @Roles('CAREGIVER', 'ADMIN', 'SUPER_ADMIN')
  async myAssignments(@CurrentViewer() viewer: Viewer): Promise<CareAssignmentDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const rows = await this.care.assignmentsForCaregiver(viewer.userId);
    // 간병사에게는 신청자 관계가 없으므로 self가 붙지 않습니다 — caregiver scope로 봅니다.
    return rows.map((r) => toAssignmentDto(r, ''));
  }

  /**
   * SCR-402 — 내 가용 시간.
   *
   * 간병사가 직접 관리합니다. 운영자가 전화로 확인하는 순간 '매칭 시간
   * 단축'이라는 MVP 검증 목표가 무너집니다 (SCR-402 notes).
   */
  @Get('caregivers/me/availability')
  @Roles('CAREGIVER', 'ADMIN', 'SUPER_ADMIN')
  async myAvailability(@CurrentViewer() viewer: Viewer): Promise<AvailabilityDto[]> {
    const rows = await this.care.listAvailability(viewer.userId!);
    return rows.map((r) => toAvailabilityDto(r, viewer.userId!));
  }

  @Post('caregivers/me/availability')
  @Roles('CAREGIVER', 'ADMIN', 'SUPER_ADMIN')
  async addAvailability(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: AvailabilityInputDto,
  ): Promise<AvailabilityDto> {
    const row = await this.care.addAvailability({ userId: viewer.userId!, ...dto });
    return toAvailabilityDto(row, viewer.userId!);
  }

  @Delete('caregivers/me/availability/:id')
  @Roles('CAREGIVER', 'ADMIN', 'SUPER_ADMIN')
  @HttpCode(204)
  async removeAvailability(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.care.removeAvailability(viewer.userId!, id);
  }

  /**
   * SCR-403 — 간병사용 근무 상세.
   *
   * **환자 실명·나이·성별·진단명이 나가지 않습니다.** 리포지토리 쿼리에 아예
   * 없습니다 (docs/11 §3.2 · README §4 C4).
   */
  @Get('care-assignments/:id/caregiver-view')
  async caregiverView(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CaregiverAssignmentDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const v = await this.care.caregiverView(id, viewer.userId, viewer.scopes.includes('admin'));
    return Object.assign(new CaregiverAssignmentDto(), {
      assignmentId: v.assignment_id,
      status: v.status,
      hospitalName: v.hospital_name,
      ward: v.ward,
      shiftPatternCode: v.shift_pattern_code,
      shiftStartTime: v.shift_start_time,
      shiftEndTime: v.shift_end_time,
      startAt: v.start_at,
      endAt: v.end_at,
      supportItems: v.support_items,
      mobilityLevel: v.mobility_level,
      cautions: v.cautions,
      restrictedFlags: v.restricted_flags,
    });
  }

  /** SCR-404 — 근무 시작. 기본은 병실 QR입니다 (§6-3). */
  @Post('care-assignments/:id/start')
  async startShift(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShiftBoundaryDto,
  ): Promise<ServiceLogDto> {
    const log = await this.care.recordShiftBoundary({
      assignmentId: id, boundary: 'START',
      checkMethod: dto.checkMethod, qrToken: dto.qrToken ?? null,
      geoPoint: dto.geoPoint ?? null, memo: dto.memo ?? null,
      actorUserId: viewer.userId!, isOperator: viewer.scopes.includes('admin'),
    });
    return toLogDto(log, viewer.userId!);
  }

  @Post('care-assignments/:id/end')
  async endShift(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShiftBoundaryDto,
  ): Promise<ServiceLogDto> {
    const log = await this.care.recordShiftBoundary({
      assignmentId: id, boundary: 'END',
      checkMethod: dto.checkMethod, qrToken: dto.qrToken ?? null,
      geoPoint: dto.geoPoint ?? null, memo: dto.memo ?? null,
      actorUserId: viewer.userId!, isOperator: viewer.scopes.includes('admin'),
    });
    return toLogDto(log, viewer.userId!);
  }

  /**
   * SCR-404 — 근무 기록 추가.
   *
   * **append-only입니다.** PATCH도 DELETE도 없습니다. 정정은 `correctionOf`로
   * 새 행을 만듭니다 — 근무시간 분쟁에서 유일한 근거가 되는 데이터라,
   * 고칠 수 있으면 근거가 아닙니다 (§5.4).
   */
  @Post('care-assignments/:id/logs')
  async appendLog(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AppendLogDto,
  ): Promise<ServiceLogDto> {
    const log = await this.care.appendLog({
      assignmentId: id, logType: dto.logType,
      itemCode: dto.itemCode ?? null, memo: dto.memo ?? null,
      correctionOf: dto.correctionOf ?? null,
      occurredAt: dto.occurredAt ?? null,
      actorUserId: viewer.userId!, isOperator: viewer.scopes.includes('admin'),
    });
    return toLogDto(log, viewer.userId!);
  }

  /**
   * SCR-306 — 근무 기록 조회.
   *
   * 보호자가 가장 많이 하는 행동이 "잘 있나 확인"입니다. 시작·종료 기록만
   * 실시간으로 보여줘도 문의가 크게 줍니다.
   *
   * 서술형 메모는 보호자에게 나가지 않습니다 — DTO scope가 자릅니다.
   */
  @Get('care-assignments/:id/logs')
  async logs(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceLogDto[]> {
    const [rows, requester] = await Promise.all([
      this.care.listServiceLogs(id),
      this.care.requesterOfAssignment(id),
    ]);
    return rows.map((r) => toLogDto(r, requester?.requester_id ?? ''));
  }
}

function toAvailabilityDto(
  a: { id: string; starts_at: Date; ends_at: Date; kind: string }, ownerUserId: string,
): AvailabilityDto {
  return Object.assign(new AvailabilityDto(), {
    ownerUserId, id: a.id, startsAt: a.starts_at, endsAt: a.ends_at, kind: a.kind,
  });
}

function toLogDto(l: ServiceLogRow, ownerUserId: string): ServiceLogDto {
  return Object.assign(new ServiceLogDto(), {
    ownerUserId,
    id: l.id,
    logType: l.log_type,
    itemCode: l.item_code,
    occurredAt: l.occurred_at,
    checkMethod: l.check_method,
    corrected: l.corrected ?? false,
    correctionOf: l.correction_of,
    memo: l.memo,
    geoPoint: l.geo_point,
    createdBy: l.created_by,
  });
}

function toRequestDto(r: CareRequestRow): CareRequestDto {
  return Object.assign(new CareRequestDto(), {
    ownerUserId: r.requester_id,
    id: r.id,
    hospitalName: r.hospital_name,
    ward: r.ward,
    serviceType: r.service_type,
    shiftPatternCode: r.shift_pattern_code,
    startAt: r.start_at,
    endAt: r.end_at,
    supportItems: r.support_items,
    mobilityLevel: r.mobility_level,
    status: r.status,
    slaDueAt: r.sla_due_at,
    cautions: r.cautions,
    restrictedFlags: r.restricted_flags,
    shiftApprovedBy: r.shift_approved_by,
  });
}

function toAssignmentDto(a: CareAssignmentRow, ownerUserId: string): CareAssignmentDto {
  return Object.assign(new CareAssignmentDto(), {
    ownerUserId,
    id: a.id,
    careRequestId: a.care_request_id,
    caregiverDisplayCode: a.caregiver_display_code ?? '',
    status: a.status,
    offeredAt: a.offered_at,
    respondedAt: a.responded_at,
    shiftStartTime: a.shift_start_time,
    shiftEndTime: a.shift_end_time,
    confirmedBy: a.confirmed_by,
    caregiverId: a.caregiver_id,
  });
}
