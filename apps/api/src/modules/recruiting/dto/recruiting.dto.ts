import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

const STAGES = ['APPLIED','SELECTED','IN_TRAINING','COMPLETED','EXAM_PASSED','PLACED','DROPPED'] as const;
const COHORT_STATUS = ['PLANNED','RECRUITING','IN_TRAINING','EXAM','PLACEMENT','CLOSED'] as const;

export class CreateCohortDto {
  @IsUUID() channelId: string;
  @IsString() @Length(1, 64) code: string;
  @IsString() @Length(1, 200) name: string;
  @IsOptional() @IsUUID() trainingPartnerId?: string;
  @IsOptional() @IsInt() @Min(1) targetSize?: number;
  @IsOptional() @IsDateString() startsOn?: string;
  @IsOptional() @IsDateString() expectedPlacementOn?: string;
}

export class CohortStatusDto {
  @IsIn(COHORT_STATUS) status: (typeof COHORT_STATUS)[number];
}

export class AddMemberDto {
  @IsUUID() candidateId: string;
}

/**
 * 유입 출처. 후보자 본인(가입 링크)과 운영자(오프라인 유입 보정) 양쪽이 쓴다.
 * 국적·성별 같은 속성은 여기 들어오지 않는다 — 출처만 기록한다.
 */
export class RecordAttributionDto {
  @IsOptional() @IsString() @Length(1, 64) channelCode?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  /** 기존 인력의 display_code (C-00115). 실명·전화번호를 추천 코드로 쓰지 않는다. */
  @IsOptional() @IsString() @Length(1, 32) referralCode?: string;
}

export class AttributionResultDto {
  /** 소유자. 'self'는 역할이 아니라 관계이므로 표시가 필요하다. */
  @ScopeOwner() userId: string;
  /** 실제로 기록된 항목. */
  @Scope('self', 'admin') applied: string[];
  /** 이미 값이 있어 무시된 항목. 조용히 덮어쓰지 않았음을 호출부가 알아야 한다. */
  @Scope('self', 'admin') ignored: string[];
}

/** 기존 인력 추천. 채널 표와 나란히 놓되 섞지 않는다 (§5.13). */
export class ReferralStatsDto {
  @Scope('admin') candidates: number;
  @Scope('admin') placed: number;
  /** 실제로 추천한 사람 수. 1명이 다 데려온 것과 여러 명이 데려온 것은 다른 상황이다. */
  @Scope('admin') referrers: number;
}

export class MoveStageDto {
  @IsIn(STAGES) stage: (typeof STAGES)[number];
  /** DROPPED에는 반드시 있어야 한다 (§5.13). */
  @IsOptional() @IsString() @Length(1, 200) dropReason?: string;
}

export class PartnerDto {
  @Scope('admin') id: string;
  @Scope('admin') partnerType: string;
  @Scope('admin') name: string;
  @Scope('admin') region: string | null;
  @Scope('admin') status: string;
  @Scope('admin') contactName: string | null;
  @Scope('admin') contactPhone: string | null;
  /** MOU 체결일. 대학 협상의 레버가 MOU라 계약이 아니라 MOU로 부른다. */
  @Scope('admin') mouSignedOn: Date | null;
  @Scope('admin') mouExpiresOn: Date | null;
}

export class ChannelCacDto {
  @Scope('admin') channelCode: string;
  @Scope('admin') labelKo: string;
  @Scope('admin') cost: number;
  @Scope('admin') candidates: number;
  @Scope('admin') placed: number;
  /** 배치 0명이면 null이다 — 0으로 나눈 값보다 '아직 없음'이 정직하다. */
  @Scope('admin') cac: number | null;
}

export class CohortDto {
  @Scope('admin') id: string;
  @Scope('admin') code: string;
  @Scope('admin') name: string;
  @Scope('admin') channelCode: string;
  @Scope('admin') status: string;
  @Scope('admin') targetSize: number | null;
  @Scope('admin') startsOn: string | null;
  @Scope('admin') expectedPlacementOn: string | null;
}

export class FunnelRowDto {
  @Scope('admin') stage: string;
  @Scope('admin') count: number;
  @Scope('admin') conversionPct: number;
}

export class DropAnalysisRowDto {
  /** 어느 단계에서 빠졌는가. 이게 없으면 대응할 수 없다. */
  @Scope('admin') droppedStage: string;
  @Scope('admin') dropReason: string | null;
  @Scope('admin') count: number;
}

export class CohortMemberDto {
  @Scope('admin') id: string;
  @Scope('admin') displayCode: string;
  @Scope('admin') candidateId: string;
  @Scope('admin') stage: string;
  @Scope('admin') joinedAt: Date;
  @Scope('admin') droppedStage: string | null;
  @Scope('admin') dropReason: string | null;
}

export class CohortDetailDto {
  @Scope('admin') cohort: CohortDto;
  @Scope('admin') funnel: FunnelRowDto[];
  @Scope('admin') dropAnalysis: DropAnalysisRowDto[];
  @Scope('admin') members: CohortMemberDto[];
}
