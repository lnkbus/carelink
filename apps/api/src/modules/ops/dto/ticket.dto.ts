import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

const TICKET_TYPES = [
  'SAFETY_INCIDENT', 'SERVICE_QUALITY', 'WORK_HOUR_DISPUTE',
  'PAYMENT', 'HARASSMENT', 'SCOPE_VIOLATION', 'OTHER',
] as const;

const TICKET_STATUS = ['NEW', 'IN_REVIEW', 'RESOLVED', 'ESCALATED'] as const;
const SEVERITY = ['LOW', 'NORMAL', 'HIGH'] as const;

/**
 * 신고 접수.
 *
 * 유형을 구조화하는 것이 요점입니다 (SCR-506 notes). '기타'로 다 받으면
 * 어느 유형이 늘고 있는지 알 수 없고, 에스컬레이션 경로도 나눌 수 없습니다.
 */
export class CreateTicketDto {
  @IsIn(TICKET_TYPES) ticketType: (typeof TICKET_TYPES)[number];
  /** 긴급 유형은 이 값과 무관하게 HIGH로 올라갑니다 — 판단은 유형이 합니다. */
  @IsOptional() @IsIn(SEVERITY) severity?: (typeof SEVERITY)[number];
  @IsOptional() @IsString() @Length(1, 32) relatedType?: string;
  @IsOptional() @IsUUID() relatedId?: string;
}

export class UpdateTicketDto {
  @IsIn(TICKET_STATUS) status: (typeof TICKET_STATUS)[number];
  /** 종결에는 필수입니다. 사유 없는 종결은 배울 것이 없습니다. */
  @IsOptional() @IsString() @Length(1, 2000) resolution?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
}

export class EscalateTicketDto {
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
}

export class TicketQueryDto {
  @IsOptional() @IsIn(TICKET_STATUS) status?: (typeof TICKET_STATUS)[number];
  @IsOptional() @IsIn(TICKET_TYPES) type?: (typeof TICKET_TYPES)[number];
}

export class TicketDto {
  /** 신고자. 자기 신고는 본인도 봅니다. */
  @ScopeOwner() ownerUserId: string;

  @Scope('self', 'admin') id: string;
  @Scope('self', 'admin') ticketType: string;
  @Scope('self', 'admin') severity: string;
  @Scope('self', 'admin') status: string;
  @Scope('self', 'admin') relatedType: string | null;
  @Scope('self', 'admin') relatedId: string | null;
  @Scope('self', 'admin') createdAt: Date;
  @Scope('self', 'admin') slaDueAt: Date | null;
  /** 음수면 이미 넘겼습니다. 화면은 `-2h`로 표기합니다. */
  @Scope('self', 'admin') slaLeftHours: number | null;
  @Scope('self', 'admin') urgent: boolean;
  @Scope('self', 'admin') resolution: string | null;

  /** 처리 경로와 담당자는 운영자만. 신고자에게 알릴 것은 진행 상태입니다. */
  @Scope('admin') route: string;
  @Scope('admin') assigneeId: string | null;
  @Scope('admin') reporterRole: string | null;
}

export class TicketSummaryDto {
  @Scope('admin') ticketType: string;
  @Scope('admin') urgent: boolean;
  @Scope('admin') route: string;
  @Scope('admin') total: number;
  @Scope('admin') open: number;
  @Scope('admin') escalated: number;
}
