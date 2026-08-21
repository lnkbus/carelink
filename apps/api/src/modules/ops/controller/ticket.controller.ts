import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  CreateTicketDto, EscalateTicketDto, TicketDto, TicketQueryDto,
  TicketSummaryDto, UpdateTicketDto,
} from '../dto/ticket.dto';
import type { TicketRow } from '../repository/ticket.repository';
import { TicketService } from '../service/ticket.service';
import { ESCALATION_ROUTE, isUrgent } from '../state/ticket.state';

/** SCR-506 사건 · 문의 관리 */
@Controller()
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  /**
   * 신고 접수. 누구나 할 수 있습니다.
   *
   * 간병사가 업무범위 초과 요구를 신고하는 경로이기도 합니다 — 여기가 막혀
   * 있으면 현장에서 거절하지 못하고 그냥 하게 됩니다.
   */
  @Post('support-tickets')
  async create(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: CreateTicketDto,
  ): Promise<TicketDto> {
    const row = await this.tickets.create({
      ticketType: dto.ticketType,
      severity: dto.severity,
      reporterId: viewer.userId,
      reporterRole: viewer.roles[0] ?? null,
      relatedType: dto.relatedType ?? null,
      relatedId: dto.relatedId ?? null,
    });
    return toDto(row, viewer);
  }

  @Get('admin/support-tickets')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async list(
    @CurrentViewer() viewer: Viewer,
    @Query() q: TicketQueryDto,
  ): Promise<TicketDto[]> {
    const rows = await this.tickets.list({ status: q.status, type: q.type });
    return rows.map((r) => toDto(r, viewer));
  }

  /** SCR-506 상단 유형별 집계. */
  @Get('admin/support-tickets/summary')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async summary(): Promise<TicketSummaryDto[]> {
    const rows = await this.tickets.countsByType();
    const byType = new Map<string, TicketSummaryDto>();
    for (const r of rows) {
      const key = r.ticket_type;
      const entry = byType.get(key) ?? Object.assign(new TicketSummaryDto(), {
        ticketType: key, urgent: isUrgent(key as never),
        route: ESCALATION_ROUTE[key as never], total: 0, open: 0, escalated: 0,
      });
      const n = Number(r.count);
      entry.total += n;
      if (r.status === 'NEW' || r.status === 'IN_REVIEW') entry.open += n;
      if (r.status === 'ESCALATED') entry.escalated += n;
      byType.set(key, entry);
    }
    // 긴급 유형을 먼저 보여줍니다 — 급한 것이 아래에 있으면 안 봅니다.
    return [...byType.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent));
  }

  @Get('admin/support-tickets/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getOne(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TicketDto> {
    return toDto(await this.tickets.getById(id), viewer);
  }

  /** 상태 변경. 종결에는 사유가 필수입니다. */
  @Patch('admin/support-tickets/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async update(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ): Promise<TicketDto> {
    const row = await this.tickets.transition({
      id, to: dto.status,
      resolution: dto.resolution ?? null,
      assigneeId: dto.assigneeId ?? null,
      actorUserId: viewer.userId!,
    });
    return toDto(row, viewer);
  }

  /**
   * 에스컬레이션. 유형별로 경로가 다릅니다.
   *
   * 부당대우는 일반 CS 경로로 가지 않습니다 — 신고자가 보복을 우려하는
   * 사안이라 처리자가 제한돼야 합니다.
   */
  @Post('admin/support-tickets/:id/escalate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async escalate(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateTicketDto,
  ): Promise<TicketDto> {
    const row = await this.tickets.escalate({
      id, reason: dto.reason ?? null, actorUserId: viewer.userId!,
    });
    return toDto(row, viewer);
  }
}

function toDto(t: TicketRow, viewer: Viewer): TicketDto {
  const slaLeftHours = t.sla_due_at
    ? Math.round((t.sla_due_at.getTime() - Date.now()) / 3_600_000)
    : null;
  return Object.assign(new TicketDto(), {
    ownerUserId: t.reporter_id ?? '',
    id: t.id,
    ticketType: t.ticket_type,
    severity: t.severity,
    status: t.status,
    relatedType: t.related_type,
    relatedId: t.related_id,
    createdAt: t.created_at,
    slaDueAt: t.sla_due_at,
    slaLeftHours,
    urgent: isUrgent(t.ticket_type),
    route: ESCALATION_ROUTE[t.ticket_type],
    resolution: t.resolution,
    assigneeId: t.assignee_id,
    reporterRole: t.reporter_role,
    // viewer는 scope 판정에만 쓰이고 응답에는 나가지 않습니다.
    ...(viewer ? {} : {}),
  });
}
