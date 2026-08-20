import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  BulkCandidateDto, BulkResultDto, ChannelInflowDto, OpsDashboardDto, QueueItemDto, TrackMetricDto,
} from '../dto/ops.dto';
import {
  CandidateDto, CandidateListQueryDto, CandidateStatusDto, PagedDto,
} from '../../talent/dto/candidate.dto';
import { CandidateService } from '../../talent/service/candidate.service';
import { OpsService } from '../service/ops.service';

/** SCR-501 운영 대시보드 · SCR-502 후보자 관리 */
@Controller('admin')
@Roles('ADMIN', 'SUPER_ADMIN')
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly candidates: CandidateService,
  ) {}

  /** GET /api/v1/admin/metrics — 모든 지표가 트랙별로 나뉘어 나온다 (§5.8). */
  @Get('metrics')
  async metrics(): Promise<OpsDashboardDto> {
    const d = await this.ops.dashboard();
    return Object.assign(new OpsDashboardDto(), {
      byTrack: d.byTrack.map((t) =>
        Object.assign(new TrackMetricDto(), {
          trackCode: t.track_code, trackLabel: t.track_label,
          candidates: Number(t.candidates), ready: Number(t.ready),
          matched: Number(t.matched), placed: Number(t.placed),
          openJobs: Number(t.open_jobs), applications: Number(t.applications),
          avgDaysToFill: t.avg_days_to_fill === null ? null : Number(t.avg_days_to_fill),
        }),
      ),
      supplyPipeline: d.supplyPipeline.map((s) => ({ step: s.step, count: Number(s.count) })),
      channelInflow: d.channelInflow.map((c) =>
        Object.assign(new ChannelInflowDto(), {
          channelCode: c.channel_code, labelKo: c.label_ko,
          candidates: Number(c.candidates), placed: Number(c.placed),
        }),
      ),
      referral: { referred: Number(d.referral?.referred ?? 0), placed: Number(d.referral?.placed ?? 0) },
      todayQueue: d.todayQueue.map((q) =>
        Object.assign(new QueueItemDto(), {
          kind: q.kind, targetId: q.target_id, label: q.label,
          slaHoursLeft: q.sla_hours_left === null ? null : Number(q.sla_hours_left),
        }),
      ),
      exclusionBreakdown: d.exclusionBreakdown.map((e) => ({ reason: e.reason, count: Number(e.count) })),
    });
  }

  /**
   * GET /api/v1/admin/candidates — SCR-502 목록.
   *
   * /candidates(SCR-203)와 같은 서비스를 부른다. 운영자 전용 경로를 따로 두는 이유는
   * SCREENS가 두 화면에 서로 다른 경로를 적고 있어서일 뿐, 조회 로직은 하나다.
   * 보이는 필드는 여기서도 DTO scope가 정한다.
   */
  @Get('candidates')
  async candidateList(
    @CurrentViewer() viewer: Viewer,
    @Query() q: CandidateListQueryDto,
  ): Promise<PagedDto<CandidateDto>> {
    return Object.assign(new PagedDto<CandidateDto>(), await this.candidates.listForConsole(q, viewer));
  }

  /** PATCH /api/v1/admin/candidates/{id}/status — SCR-502 단건 상태 변경. */
  @Patch('candidates/:id/status')
  async candidateStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CandidateStatusDto,
  ): Promise<CandidateDto> {
    await this.candidates.changeStatus(id, dto.status, viewer.userId!);
    return this.candidates.toDto(await this.candidates.getById(id), viewer);
  }

  /** POST /api/v1/admin/candidates/bulk — SCR-502 일괄 처리 바 */
  @Post('candidates/bulk')
  async bulk(@CurrentViewer() viewer: Viewer, @Body() dto: BulkCandidateDto): Promise<BulkResultDto> {
    const result = await this.ops.bulkUpdate({
      candidateIds: dto.candidateIds, operation: dto.operation,
      status: dto.status, assigneeId: dto.assigneeId, tag: dto.tag,
      actorUserId: viewer.userId!,
    });
    return Object.assign(new BulkResultDto(), result);
  }
}
