import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  ComplianceCheckDto, ComplianceCheckInputDto, CreateEngagementDto, EngagementDto,
  CorrectWorkRecordDto, DispatchStatusDto, EngagementStatusDto, ModelSpecDto,
  SwitchModelDto, WorkRecordDto,
} from '../dto/engagement.dto';
import type { ComplianceCheckRow, EngagementRow } from '../repository/engagement.repository';
import { EngagementService } from '../service/engagement.service';
import type { WorkRecordRow } from '../repository/work-record.repository';
import { WorkRecordService } from '../service/work-record.service';
import type { EngagementModel } from '../strategy/engagement.strategy';

/** SCR-508 고용 · 계약 */
@Controller('engagements')
@Roles('ADMIN', 'SUPER_ADMIN')
export class EngagementController {
  constructor(
    private readonly engagements: EngagementService,
    private readonly workRecords: WorkRecordService,
  ) {}

  /** 모델별 요구 서류·컴플라이언스 정의. 화면이 무엇을 요구할지 여기서 읽는다. */
  @Get('models/:model/spec')
  spec(@Param('model') model: string): ModelSpecDto {
    return Object.assign(new ModelSpecDto(), this.engagements.modelSpec(model as EngagementModel));
  }

  @Get()
  async list(
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
  ): Promise<EngagementDto[]> {
    const rows = await this.engagements.list({ organizationId, status: status as never });
    return rows.map(toDto);
  }

  @Get(':id')
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<EngagementDto> {
    return toDto(await this.engagements.getById(id));
  }

  /**
   * GET /api/v1/engagements/{id}/dispatch — 파견 2년 한도 잔여.
   *
   * 배치 한 건의 기간이 아니라 **같은 인력×기관의 누적**입니다 (파견법 §6).
   * 종료·재배치를 반복해도 누적은 이어집니다.
   */
  @Get(':id/dispatch')
  async dispatch(@Param('id', ParseUUIDPipe) id: string): Promise<DispatchStatusDto> {
    const e = await this.engagements.getById(id);
    const r = await this.engagements.dispatchRemaining(e.worker_user_id, e.organization_id);
    return Object.assign(new DispatchStatusDto(), {
      isDispatch: e.is_dispatch,
      daysUsed: r.used,
      daysLeft: r.remaining,
      limitDays: r.limit,
      exceeded: r.remaining <= 0,
    });
  }

  @Get(':id/compliance')
  async checks(@Param('id', ParseUUIDPipe) id: string): Promise<ComplianceCheckDto[]> {
    return (await this.engagements.listChecks(id)).map(toCheckDto);
  }

  /** 배치 생성. 클리어런스 6개가 전부 PASS가 아니면 여기서 막힌다. */
  @Post()
  async create(@CurrentViewer() viewer: Viewer, @Body() dto: CreateEngagementDto): Promise<EngagementDto> {
    const row = await this.engagements.create({
      workerUserId: dto.workerUserId, candidateId: dto.candidateId ?? null,
      organizationId: dto.organizationId, trackId: dto.trackId, jobId: dto.jobId ?? null,
      model: dto.model, startedOn: dto.startedOn ?? null,
      isDispatch: dto.isDispatch ?? false,
      dispatchStartedOn: dto.dispatchStartedOn ?? null,
      dispatchPermitNo: dto.dispatchPermitNo ?? null,
      previousEngagementId: null, actorUserId: viewer.userId!,
    });
    return toDto(row);
  }

  /**
   * GET /api/v1/engagements/{id}/work-records
   *
   * `service_logs`(버티컬)에서 집계된 코어 기록입니다. 어느 산업이든 사람은
   * 일하고 정산되므로 이 테이블은 코어에 있습니다 (§5.14).
   */
  @Get(':id/work-records')
  async listWorkRecords(@Param('id', ParseUUIDPipe) id: string): Promise<WorkRecordDto[]> {
    return (await this.workRecords.list(id)).map(toWorkRecordDto);
  }

  /**
   * 근무 기록 승인. 집계는 자동이지만 확정은 사람이 합니다 —
   * 자동 집계가 틀렸을 때 되돌릴 지점이 필요합니다.
   */
  @Patch('work-records/:id/approve')
  async approveWorkRecord(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkRecordDto> {
    return toWorkRecordDto(await this.workRecords.approve(id, viewer.userId!));
  }

  /**
   * 근무 기록 정정.
   *
   * **기존 행을 고치지 않습니다.** 정정은 correction_of로 새 행입니다 —
   * service_logs와 같은 이유이고, 이 둘이 정산 분쟁의 근거 체인입니다 (§5.4).
   */
  @Post('work-records/:id/correct')
  async correctWorkRecord(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectWorkRecordDto,
  ): Promise<WorkRecordDto> {
    return toWorkRecordDto(await this.workRecords.correct({
      originalId: id, ...dto, actorUserId: viewer.userId!,
    }));
  }

  @Patch(':id/compliance')
  async recordCheck(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ComplianceCheckInputDto,
  ): Promise<ComplianceCheckDto[]> {
    const rows = await this.engagements.recordCheck(id, dto.checkCode, dto.result, dto.note ?? null, viewer.userId!);
    return rows.map(toCheckDto);
  }

  /** ACTIVE 전이는 컴플라이언스 체크가 전부 PASS일 때만 통과한다 (§6-9). */
  @Patch(':id/status')
  async changeStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EngagementStatusDto,
  ): Promise<EngagementDto> {
    return toDto(await this.engagements.changeStatus(id, dto.status, dto.endReason ?? null, viewer.userId!));
  }

  /**
   * 고용 모델 전환. 기존 건을 ENDED 처리하고 새 engagement를 만든다 —
   * UPDATE가 아니다. 과거 정산은 그 시점의 모델로 보존된다 (§5.7).
   */
  @Post(':id/switch-model')
  async switchModel(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SwitchModelDto,
  ): Promise<EngagementDto> {
    return toDto(await this.engagements.switchModel({
      engagementId: id, newModel: dto.model, startedOn: dto.startedOn ?? null, actorUserId: viewer.userId!,
    }));
  }
}

function toDto(e: EngagementRow): EngagementDto {
  return Object.assign(new EngagementDto(), {
    id: e.id, model: e.model, status: e.status,
    organizationId: e.organization_id, organizationName: e.organization_name ?? '',
    trackCode: e.track_code ?? '',
    startedOn: e.started_on ? e.started_on.toISOString().slice(0, 10) : null,
    endedOn: e.ended_on ? e.ended_on.toISOString().slice(0, 10) : null,
    endReason: e.end_reason, previousEngagementId: e.previous_engagement_id,
    isDispatch: e.is_dispatch,
    dispatchStartedOn: e.dispatch_started_on ? e.dispatch_started_on.toISOString().slice(0, 10) : null,
    dispatchPermitNo: e.dispatch_permit_no,
    // 목록에서 인력×기관 누적을 건마다 조회하면 N+1이 됩니다.
    // 잔여 일수는 /engagements/{id}/dispatch 에서 따로 봅니다.
    dispatchDaysLeft: null,
    displayCode: e.display_code ?? null, workerUserId: e.worker_user_id,
  });
}

function toWorkRecordDto(w: WorkRecordRow): WorkRecordDto {
  return Object.assign(new WorkRecordDto(), {
    id: w.id,
    engagementId: w.engagement_id,
    sourceType: w.source_type,
    sourceId: w.source_id,
    workDate: w.work_date.toISOString().slice(0, 10),
    startedAt: w.started_at,
    endedAt: w.ended_at,
    breakMinutes: w.break_minutes,
    normalMinutes: w.normal_minutes,
    nightMinutes: w.night_minutes,
    overtimeMinutes: w.overtime_minutes,
    holidayMinutes: w.holiday_minutes,
    approvedAt: w.approved_at,
    approvedBy: w.approved_by,
    correctionOf: w.correction_of,
  });
}

function toCheckDto(c: ComplianceCheckRow): ComplianceCheckDto {
  return Object.assign(new ComplianceCheckDto(), {
    checkCode: c.check_code, result: c.result, checkedAt: c.checked_at, note: c.note,
  });
}
