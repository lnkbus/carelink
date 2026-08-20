import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Scope } from '../../../core/scope/scope.decorator';
import { REQUIRED_CLEARANCES } from '../state/clearance.state';

const RESULTS = ['PENDING', 'PASS', 'FAIL', 'EXPIRED', 'N_A'] as const;

/**
 * 검사 결과 입력. 플랫폼은 판정하지 않고 사람이 확인한 결과를 기록한다 (§6-1).
 * 그래서 result는 필수이고 자동 계산되는 필드가 없다.
 */
export class RecordClearanceDto {
  @IsIn(RESULTS) result: (typeof RESULTS)[number];
  /** 확인에 쓴 서류. 원본은 확인 후 파기하고 결과값만 남는다 (§6-18). */
  @IsOptional() @IsUUID() documentId?: string;
  /** 범죄경력 2년, 건강진단 1년. 만료되면 신규 배정이 차단된다 (docs/07 §3.1). */
  @IsOptional() @IsISO8601() expiresOn?: string;
  @IsOptional() @IsString() @Length(1, 500) note?: string;
}

export class ClearanceQueryDto {
  @IsOptional() @IsIn(RESULTS) result?: (typeof RESULTS)[number];
  /** 만료 N일 이내. 배치 중인 인력이 먼저 나온다. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) expiring?: number;
}

/**
 * 클리어런스 한 줄.
 *
 * 이 화면은 '검증 상태'를 보는 곳이다. 실명·생년월일·국적은 여기 들어오지 않는다 —
 * 검증되지 않은 인력을 거르는 것이지 사람을 거르는 것이 아니기 때문이다 (§5.10).
 */
export class ClearanceDto {
  @Scope('admin') id: string;
  @Scope('admin') workerUserId: string;
  @Scope('admin') displayCode: string | null;
  @Scope('admin') clearanceType: string;
  @Scope('admin') result: string;
  @Scope('admin') expiresOn: string | null;
  @Scope('admin') checkedAt: Date | null;
  @Scope('admin') note: string | null;
  /** 배치 중인 인력의 만료는 먼저 처리해야 한다. */
  @Scope('admin') candidateStatus: string | null;
  /** 남은 일수. 음수면 이미 만료다. */
  @Scope('admin') daysToExpiry: number | null;
}

export class WorkerClearanceSummaryDto {
  @Scope('admin') workerUserId: string;
  @Scope('admin') items: ClearanceItemDto[];
  /** 6개 전부 통과해야 true. 운영자가 뒤집을 수 있는 값이 아니다 (§5.11). */
  @Scope('admin') deployable: boolean;
  @Scope('admin') missing: string[];
  @Scope('admin') expired: string[];
}

export class ClearanceItemDto {
  @Scope('admin') clearanceType: string;
  @Scope('admin') result: string;
  /** false면 아직 검사 기록 자체가 없다. PENDING과 구분해서 보여줘야 한다. */
  @Scope('admin') recorded: boolean;
  @Scope('admin') expiresOn: string | null;
  @Scope('admin') id: string | null;
}

/** 자유 입력 스캔 미리보기. 운영자가 문구를 검토할 때 쓴다. */
export class ScopeScanRequestDto {
  @IsString() @Length(1, 4000) text: string;
}

export class ScopeScanResultDto {
  @Scope('admin') clean: boolean;
  /** 감지돼도 거절이 아니다. 사람이 설명하도록 OPS_REVIEW로 보낸다 (§6-15). */
  @Scope('admin') action: string;
  @Scope('admin') hits: { keyword: string; category: string; index: number }[];
}

export class RestrictedFlagDto {
  @Scope('admin') careRequestId: string;
  @Scope('admin') flags: string[];
  @Scope('admin') status: string;
  @Scope('admin') createdAt: Date;
  @Scope('admin') ward: string | null;
}

export const CLEARANCE_TYPES = REQUIRED_CLEARANCES;
