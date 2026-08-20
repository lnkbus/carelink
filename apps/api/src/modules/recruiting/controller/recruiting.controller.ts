import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  AddMemberDto, ChannelCacDto, CohortDetailDto, CohortDto, CohortMemberDto, CohortStatusDto,
  CreateCohortDto, DropAnalysisRowDto, FunnelRowDto, MoveStageDto, PartnerDto, ReferralStatsDto,
} from '../dto/recruiting.dto';
import type { CohortMemberRow, CohortRow } from '../repository/recruiting.repository';
import { RecruitingService } from '../service/recruiting.service';

/** SCR-510 파트너·채널 · SCR-511 코호트 파이프라인 */
@Controller('admin/recruiting')
@Roles('ADMIN', 'SUPER_ADMIN')
export class RecruitingController {
  constructor(private readonly recruiting: RecruitingService) {}

  @Get('partners')
  async partners(@Query('type') type?: string): Promise<PartnerDto[]> {
    const rows = await this.recruiting.listPartners(type);
    return rows.map((p) =>
      Object.assign(new PartnerDto(), {
        id: p.id, partnerType: p.partner_type, name: p.name, region: p.region,
        status: p.status, contactName: p.contact_name, contactPhone: p.contact_phone,
        contractSignedOn: p.contract_signed_on,
      }),
    );
  }

  /** SCR-510 — 채널별 CAC. 이게 없으면 예산 배분을 할 수 없다 (§5.13). */
  @Get('channels/cac')
  async cac(): Promise<ChannelCacDto[]> {
    const rows = await this.recruiting.channelCac();
    return rows.map((c) =>
      Object.assign(new ChannelCacDto(), {
        channelCode: c.channel_code, labelKo: c.label_ko,
        cost: Number(c.cost), candidates: Number(c.candidates), placed: Number(c.placed),
        cac: c.cac === null ? null : Number(c.cac),
      }),
    );
  }

  /** SCR-510 — 기존 인력 추천은 채널이 아니라 별도 축으로 집계한다 (§5.13). */
  @Get('channels/referrals')
  async referrals(): Promise<ReferralStatsDto> {
    return Object.assign(new ReferralStatsDto(), await this.recruiting.referralStats());
  }

  @Get('cohorts')
  async cohorts(): Promise<CohortDto[]> {
    return (await this.recruiting.listCohorts()).map(toCohortDto);
  }

  @Post('cohorts')
  async createCohort(@Body() dto: CreateCohortDto): Promise<CohortDto> {
    return toCohortDto(await this.recruiting.createCohort({
      channelId: dto.channelId, code: dto.code, name: dto.name,
      trainingPartnerId: dto.trainingPartnerId ?? null,
      targetSize: dto.targetSize ?? null,
      startsOn: dto.startsOn ?? null,
      expectedPlacementOn: dto.expectedPlacementOn ?? null,
    }));
  }

  @Patch('cohorts/:id/status')
  async cohortStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CohortStatusDto,
  ): Promise<CohortDto> {
    return toCohortDto(await this.recruiting.changeCohortStatus(id, dto.status, viewer.userId!));
  }

  /** SCR-511 — 퍼널 + 이탈 시점 분석 */
  @Get('cohorts/:id')
  async cohortDetail(@Param('id', ParseUUIDPipe) id: string): Promise<CohortDetailDto> {
    const [cohort, funnel, drops, members] = await Promise.all([
      this.recruiting.getCohort(id),
      this.recruiting.funnel(id),
      this.recruiting.dropAnalysis(id),
      this.recruiting.listMembers(id),
    ]);
    return Object.assign(new CohortDetailDto(), {
      cohort: toCohortDto(cohort),
      funnel: funnel.map((f) => Object.assign(new FunnelRowDto(), f)),
      dropAnalysis: drops.map((d) =>
        Object.assign(new DropAnalysisRowDto(), {
          droppedStage: d.dropped_stage, dropReason: d.drop_reason, count: Number(d.count),
        }),
      ),
      members: members.map(toMemberDto),
    });
  }

  @Post('cohorts/:id/members')
  async addMember(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ): Promise<CohortMemberDto> {
    return toMemberDto(await this.recruiting.addMember(id, dto.candidateId, viewer.userId!));
  }

  @Patch('cohort-members/:id/stage')
  async moveStage(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveStageDto,
  ): Promise<CohortMemberDto> {
    return toMemberDto(await this.recruiting.moveStage({
      memberId: id, to: dto.stage, dropReason: dto.dropReason ?? null, actorUserId: viewer.userId!,
    }));
  }
}

function toCohortDto(c: CohortRow): CohortDto {
  return Object.assign(new CohortDto(), {
    id: c.id, code: c.code, name: c.name, channelCode: c.channel_code ?? '',
    status: c.status, targetSize: c.target_size,
    startsOn: c.starts_on ? c.starts_on.toISOString().slice(0, 10) : null,
    expectedPlacementOn: c.expected_placement_on ? c.expected_placement_on.toISOString().slice(0, 10) : null,
  });
}

function toMemberDto(m: CohortMemberRow): CohortMemberDto {
  return Object.assign(new CohortMemberDto(), {
    id: m.id, displayCode: m.display_code ?? '', candidateId: m.candidate_id,
    stage: m.stage, joinedAt: m.joined_at,
    droppedStage: m.dropped_stage, dropReason: m.drop_reason,
  });
}
