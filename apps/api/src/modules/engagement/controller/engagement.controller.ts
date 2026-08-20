import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  ComplianceCheckDto, ComplianceCheckInputDto, CreateEngagementDto, EngagementDto,
  EngagementStatusDto, ModelSpecDto, SwitchModelDto,
} from '../dto/engagement.dto';
import type { ComplianceCheckRow, EngagementRow } from '../repository/engagement.repository';
import { EngagementService } from '../service/engagement.service';
import type { EngagementModel } from '../strategy/engagement.strategy';

/** SCR-508 고용 · 계약 */
@Controller('engagements')
@Roles('ADMIN', 'SUPER_ADMIN')
export class EngagementController {
  constructor(private readonly engagements: EngagementService) {}

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
      previousEngagementId: null, actorUserId: viewer.userId!,
    });
    return toDto(row);
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
    displayCode: e.display_code ?? null, workerUserId: e.worker_user_id,
  });
}

function toCheckDto(c: ComplianceCheckRow): ComplianceCheckDto {
  return Object.assign(new ComplianceCheckDto(), {
    checkCode: c.check_code, result: c.result, checkedAt: c.checked_at, note: c.note,
  });
}
