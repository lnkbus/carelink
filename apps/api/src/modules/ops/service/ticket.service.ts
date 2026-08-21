import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { TicketRepository, type TicketRow } from '../repository/ticket.repository';
import {
  ESCALATION_ROUTE, isUrgent, ticketMachine, TICKET_SLA_HOURS,
  type TicketStatus, type TicketType,
} from '../state/ticket.state';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

/**
 * ops — 사건·문의 (SCR-506).
 *
 * **유형별로 에스컬레이션 경로를 분리합니다** (SCR-506 notes). 전부 같은
 * 담당자에게 올리면 안전사고와 결제 문의가 같은 큐에 쌓이고 급한 것이 묻힙니다.
 */
@Injectable()
export class TicketService {
  private readonly log = new Logger(TicketService.name);

  constructor(
    private readonly repo: TicketRepository,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  list(filter: Parameters<TicketRepository['list']>[0]) { return this.repo.list(filter); }
  countsByType() { return this.repo.countsByType(); }
  overdue() { return this.repo.overdue(); }

  async getById(id: string): Promise<TicketRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'support_ticket', targetId: id });
    return row;
  }

  /**
   * 티켓 생성.
   *
   * 안전사고·부당대우·업무범위 초과는 **4시간 SLA**가 자동으로 붙습니다.
   * 신고자가 심각도를 낮게 적어도 유형이 이 셋이면 SLA는 붙습니다 —
   * 심각도 판단은 신고자가 아니라 유형이 합니다.
   */
  async create(input: {
    ticketType: TicketType; severity?: string;
    reporterId: string | null; reporterRole: string | null;
    relatedType: string | null; relatedId: string | null;
  }): Promise<TicketRow> {
    const urgent = isUrgent(input.ticketType);

    const ticket = await this.repo.create({
      ticketType: input.ticketType,
      // 긴급 유형은 신고자가 뭐라 적든 최소 HIGH입니다.
      severity: urgent ? 'HIGH' : (input.severity ?? 'NORMAL'),
      reporterId: input.reporterId,
      reporterRole: input.reporterRole,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      slaHours: urgent ? TICKET_SLA_HOURS : null,
    });

    await this.audit.record({
      actorUserId: input.reporterId, action: 'STATUS_CHANGE',
      targetType: 'support_ticket', targetId: ticket.id,
      after: { ticketType: input.ticketType, severity: ticket.severity, urgent },
    });

    if (urgent) {
      this.log.warn(
        `support_ticket ${ticket.id}: ${input.ticketType} — 4시간 SLA · ` +
        `경로 ${ESCALATION_ROUTE[input.ticketType]}`,
      );
    }
    return ticket;
  }

  async transition(input: {
    id: string; to: TicketStatus; resolution: string | null;
    assigneeId: string | null; actorUserId: string;
  }): Promise<TicketRow> {
    const before = await this.getById(input.id);
    ticketMachine.assert(before.status, input.to);

    // 종결에는 사유가 필수입니다. 사유 없는 종결은 "닫았다"는 기록일 뿐
    // 무엇을 했는지 남지 않고, 같은 사건이 반복될 때 참고할 것이 없습니다.
    if (input.to === 'RESOLVED' && !input.resolution && !before.resolution) {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: 'ops.ticket', to: 'RESOLVED',
        reason: 'a resolution note is mandatory — closing without one leaves nothing to learn from',
      });
    }

    await this.repo.update(input.id, {
      status: input.to,
      assigneeId: input.assigneeId,
      resolution: input.resolution,
    });

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'support_ticket', targetId: input.id,
      before: { status: before.status },
      after: { status: input.to, assigneeId: input.assigneeId, resolution: input.resolution },
    });
    return this.getById(input.id);
  }

  /**
   * 에스컬레이션.
   *
   * 유형별 경로를 알림에 실어 보냅니다. 어디로 가야 하는지 모르는 에스컬레이션은
   * 그냥 상태 변경일 뿐입니다.
   */
  async escalate(input: {
    id: string; reason: string | null; actorUserId: string;
  }): Promise<TicketRow> {
    const before = await this.getById(input.id);
    ticketMachine.assert(before.status, 'ESCALATED');

    const route = ESCALATION_ROUTE[before.ticket_type];
    await this.repo.update(input.id, { status: 'ESCALATED' });

    if (before.reporter_id) {
      await this.notifications.enqueue(before.reporter_id, 'TICKET_ESCALATED', {
        dedupeKey: `${input.id}:escalated`,
        ticketId: input.id,
        ticketType: before.ticket_type,
        route,
      });
    }

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'support_ticket', targetId: input.id,
      before: { status: before.status },
      after: { status: 'ESCALATED', route, reason: input.reason },
    });

    this.log.warn(`support_ticket ${input.id} 에스컬레이션 → ${route} (${before.ticket_type})`);
    return this.getById(input.id);
  }
}
