import { IsArray, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Scope } from '../../../core/scope/scope.decorator';

const CANDIDATE_STATUS = ['DRAFT','DOC_REVIEW','TRAINING','READY','MATCHED','PLACED','INACTIVE','SUSPENDED'] as const;

/** SCR-502 일괄 처리. 단건 편집만 되는 관리자는 실무에서 쓰이지 않는다 (SCR-502 notes). */
export class BulkCandidateDto {
  @IsArray() @IsUUID('4', { each: true }) candidateIds: string[];
  @IsIn(['STATUS', 'ASSIGNEE', 'TAG']) operation: 'STATUS' | 'ASSIGNEE' | 'TAG';
  @IsOptional() @IsIn(CANDIDATE_STATUS) status?: (typeof CANDIDATE_STATUS)[number];
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsString() @Length(1, 64) tag?: string;
}

export class BulkResultDto {
  @Scope('admin') requested: number;
  @Scope('admin') succeeded: number;
  /** 실패는 조용히 넘기지 않는다. 무엇이 왜 실패했는지 건별로 돌려준다. */
  @Scope('admin') failures: { candidateId: string; code: string; detail?: unknown }[];
}

export class TrackMetricDto {
  @Scope('admin') trackCode: string;
  @Scope('admin') trackLabel: string;
  @Scope('admin') candidates: number;
  @Scope('admin') ready: number;
  @Scope('admin') matched: number;
  @Scope('admin') placed: number;
  @Scope('admin') openJobs: number;
  @Scope('admin') applications: number;
  /** 단 하나만 본다면 이 값이다 (docs/01 §11). */
  @Scope('admin') avgDaysToFill: number | null;
}

export class ChannelInflowDto {
  @Scope('admin') channelCode: string;
  @Scope('admin') labelKo: string;
  @Scope('admin') candidates: number;
  @Scope('admin') placed: number;
}

export class QueueItemDto {
  @Scope('admin') kind: string;
  @Scope('admin') targetId: string;
  @Scope('admin') label: string;
  /** 음수면 SLA 초과다 (SCR-501의 `-2h` 표기). */
  @Scope('admin') slaHoursLeft: number | null;
}

export class OpsDashboardDto {
  /** 트랙별로 분리한다. 합산만 보면 어느 트랙이 통했는지 판별할 수 없다 (§5.8). */
  @Scope('admin') byTrack: TrackMetricDto[];
  @Scope('admin') supplyPipeline: { step: string; count: number }[];
  @Scope('admin') channelInflow: ChannelInflowDto[];
  /** 기존 인력 추천은 전환율이 가장 높은 채널이라 따로 본다 (§5.13). */
  @Scope('admin') referral: { referred: number; placed: number };
  @Scope('admin') todayQueue: QueueItemDto[];
  @Scope('admin') exclusionBreakdown: { reason: string; count: number }[];
}
