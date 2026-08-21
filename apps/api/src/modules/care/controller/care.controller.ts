import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  AssignmentStatusDto, CareAssignmentDto, CareMatchResultDto, CareRequestDto,
  CareRequestQueryDto, CareRequestStatusDto, CaregiverCardDto,
  CreateCareRequestDto, OfferAssignmentDto,
} from '../dto/care.dto';
import type { CareAssignmentRow, CareRequestRow } from '../repository/care.repository';
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

  /** 파트너 병원만 노출합니다 — 공급이 없는 병원을 열면 취소율이 오릅니다. */
  @Get('care-hospitals')
  async hospitals(): Promise<{ id: string; name: string; region: string | null; activeCaregivers: number }[]> {
    return (await this.care.listHospitals()).map((h) => ({
      id: h.id, name: h.name, region: h.region, activeCaregivers: h.active_caregivers,
    }));
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
