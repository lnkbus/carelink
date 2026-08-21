import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import { TicketRepository } from '../repository/ticket.repository';
import { ESCALATION_ROUTE } from '../state/ticket.state';
import { NotificationService } from '../service/notification.service';
import type { JobResult } from './expiry.jobs';

/**
 * 사건 SLA (CLAUDE.md §7).
 *
 * 안전사고·부당대우·업무범위 초과가 4시간을 넘기면 알립니다.
 *
 * **없으면 대응 실패가 사업 리스크로 전이됩니다.** 이 셋은 늦으면 사람이
 * 다치거나(안전사고), 인력 공급망이 끊기거나(부당대우), 무면허 의료행위가
 * 됩니다(업무범위). 조용히 쌓이면 아무도 모르는 채로 커집니다.
 */
@Injectable()
export class TicketJobs implements OnModuleInit {
  private readonly log = new Logger(TicketJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: TicketRepository,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.TICKET_SLA.name, () => this.ticketSla());
  }

  async ticketSla(): Promise<JobResult> {
    const rows = await this.repo.overdue();
    let acted = 0;
    let skipped = 0;

    for (const row of rows) {
      const dedupeKey = `${row.id}:${row.sla_due_at?.toISOString().slice(0, 13)}`;
      const target = row.assignee_id ?? row.reporter_id;
      if (!target) { skipped++; continue; }
      if (await this.notifications.sentToday(target, 'TICKET_SLA_BREACHED', dedupeKey)) {
        skipped++;
        continue;
      }

      const overdueHours = row.sla_due_at
        ? Math.round((Date.now() - row.sla_due_at.getTime()) / 3_600_000)
        : 0;

      await this.notifications.enqueue(target, 'TICKET_SLA_BREACHED', {
        dedupeKey,
        ticketId: row.id,
        ticketType: row.ticket_type,
        severity: row.severity,
        overdueHours,
        // 어디로 올려야 하는지 함께 보냅니다 — 경로를 모르면 알림이
        // '늦었다'는 사실만 전하고 아무 일도 일어나지 않습니다.
        route: ESCALATION_ROUTE[row.ticket_type],
        // 담당자가 없는 건이 가장 위험합니다. 아무도 자기 일이라고 생각하지 않습니다.
        unassigned: row.assignee_id === null,
      });
      acted++;
    }

    const unassigned = rows.filter((r) => r.assignee_id === null).length;
    if (rows.length > 0) {
      this.log.warn(
        `ticket-sla: SLA 초과 ${rows.length}건 · 알림 ${acted}건` +
        (unassigned > 0 ? ` · 담당자 없음 ${unassigned}건` : ''),
      );
    }
    return { job: JOBS.TICKET_SLA.name, scanned: rows.length, acted, skipped };
  }
}
