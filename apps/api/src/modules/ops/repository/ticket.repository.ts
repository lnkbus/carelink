import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { TicketStatus, TicketType } from '../state/ticket.state';

export interface TicketRow {
  id: string; ticket_type: TicketType; severity: string;
  reporter_id: string | null; reporter_role: string | null;
  related_type: string | null; related_id: string | null;
  assignee_id: string | null; status: TicketStatus;
  sla_due_at: Date | null; resolution: string | null;
  created_at: Date; resolved_at: Date | null;
}

const COLS = `id, ticket_type::text AS ticket_type, severity, reporter_id,
              reporter_role::text AS reporter_role, related_type, related_id,
              assignee_id, status::text AS status, sla_due_at, resolution,
              created_at, resolved_at`;

@Injectable()
export class TicketRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<TicketRow | null> {
    return this.db.one<TicketRow>(`SELECT ${COLS} FROM support_tickets WHERE id = $1`, [id]);
  }

  /** SLA 임박 순. 운영자가 보는 것은 "지금 어디가 급한가"입니다. */
  list(filter: { status?: string; type?: string; assigneeId?: string }): Promise<TicketRow[]> {
    return this.db.query<TicketRow>(
      `SELECT ${COLS} FROM support_tickets
        WHERE ($1::text IS NULL OR status::text = $1)
          AND ($2::text IS NULL OR ticket_type::text = $2)
          AND ($3::uuid IS NULL OR assignee_id = $3)
        ORDER BY (status IN ('NEW','ESCALATED')) DESC,
                 sla_due_at NULLS LAST, created_at DESC`,
      [filter.status ?? null, filter.type ?? null, filter.assigneeId ?? null],
    );
  }

  async create(input: {
    ticketType: TicketType; severity: string; reporterId: string | null;
    reporterRole: string | null; relatedType: string | null; relatedId: string | null;
    slaHours: number | null;
  }): Promise<TicketRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO support_tickets
         (ticket_type, severity, reporter_id, reporter_role, related_type, related_id, sla_due_at)
       VALUES ($1::ticket_type, $2, $3, $4::user_role, $5, $6,
               CASE WHEN $7::int IS NULL THEN NULL
                    ELSE now() + ($7::text || ' hours')::interval END)
       RETURNING id`,
      [input.ticketType, input.severity, input.reporterId, input.reporterRole,
       input.relatedType, input.relatedId, input.slaHours],
    );
    return (await this.findById(row!.id))!;
  }

  async update(id: string, patch: {
    status?: TicketStatus; assigneeId?: string | null; resolution?: string | null;
  }): Promise<void> {
    await this.db.query(
      `UPDATE support_tickets
          SET status = COALESCE($2::ticket_status, status),
              assignee_id = COALESCE($3::uuid, assignee_id),
              resolution = COALESCE($4, resolution),
              resolved_at = CASE WHEN $2::text = 'RESOLVED' THEN now() ELSE resolved_at END
        WHERE id = $1`,
      [id, patch.status ?? null, patch.assigneeId ?? null, patch.resolution ?? null],
    );
  }

  /** SLA를 넘긴 미해결 티켓. ticket-sla 잡이 씁니다. */
  overdue(): Promise<TicketRow[]> {
    return this.db.query<TicketRow>(
      `SELECT ${COLS} FROM support_tickets
        WHERE status IN ('NEW','IN_REVIEW')
          AND sla_due_at IS NOT NULL AND sla_due_at <= now()
        ORDER BY sla_due_at`,
    );
  }

  /** SCR-506 상단 유형별 집계. */
  countsByType(): Promise<{ ticket_type: string; status: string; count: string }[]> {
    return this.db.query(
      `SELECT ticket_type::text AS ticket_type, status::text AS status, count(*)::text AS count
         FROM support_tickets GROUP BY 1, 2 ORDER BY 1, 2`,
    );
  }
}
