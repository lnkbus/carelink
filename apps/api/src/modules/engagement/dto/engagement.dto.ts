import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { Scope } from '../../../core/scope/scope.decorator';

const MODELS = ['DIRECT_EMPLOYMENT', 'DELEGATION', 'BROKERAGE'] as const;
const STATUS = ['DRAFT', 'CONTRACT_PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'ENDED'] as const;
const CHECK_RESULT = ['PENDING', 'PASS', 'FAIL', 'N_A'] as const;

export class CreateEngagementDto {
  @IsUUID() workerUserId: string;
  @IsOptional() @IsUUID() candidateId?: string;
  @IsUUID() organizationId: string;
  @IsUUID() trackId: string;
  @IsOptional() @IsUUID() jobId?: string;
  /** 고용 모델은 배치 단위다. 전역 설정이 아니다 (§5.7). */
  @IsIn(MODELS) model: (typeof MODELS)[number];
  @IsOptional() @IsDateString() startedOn?: string;
  /**
   * 근로자파견 여부 (2026-08-21 U1·U2 확정).
   *
   * 참이면 파견법 §6의 2년 제한과 §7의 허가번호 기재 의무가 걸립니다.
   * 서비스가 생성 시점에 누적 일수를 확인하고 초과분을 막습니다.
   */
  @IsOptional() @IsBoolean() isDispatch?: boolean;
  @IsOptional() @IsDateString() dispatchStartedOn?: string;
  /** 근로자파견사업 허가번호. 파견 건은 이것 없이 만들 수 없습니다. */
  @IsOptional() @IsString() @Length(1, 64) dispatchPermitNo?: string;
}

export class EngagementStatusDto {
  @IsIn(STATUS) status: (typeof STATUS)[number];
  @IsOptional() @IsString() @Length(1, 120) endReason?: string;
}

export class ComplianceCheckInputDto {
  @IsString() @Length(1, 64) checkCode: string;
  @IsIn(CHECK_RESULT) result: (typeof CHECK_RESULT)[number];
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
}

export class SwitchModelDto {
  @IsIn(MODELS) model: (typeof MODELS)[number];
  @IsOptional() @IsDateString() startedOn?: string;
}

export class ComplianceCheckDto {
  @Scope('admin', 'org') checkCode: string;
  @Scope('admin', 'org') result: string;
  @Scope('admin', 'org') checkedAt: Date | null;
  @Scope('admin') note: string | null;
}

export class EngagementDto {
  @Scope('admin', 'org') id: string;
  @Scope('admin', 'org') model: string;
  @Scope('admin', 'org') status: string;
  @Scope('admin', 'org') organizationId: string;
  @Scope('admin', 'org') organizationName: string;
  @Scope('admin', 'org') trackCode: string;
  @Scope('admin', 'org') startedOn: string | null;
  @Scope('admin', 'org') endedOn: string | null;
  @Scope('admin', 'org') endReason: string | null;
  /** 모델 전환 이력. 과거 정산은 그 시점의 모델로 보존된다. */
  @Scope('admin', 'org') previousEngagementId: string | null;
  @Scope('admin', 'org') displayCode: string | null;
  /** 인력의 user_id는 운영자만 본다. */
  @Scope('admin') workerUserId: string;

  // 파견 정보. 기관도 봐야 합니다 — 2년 한도는 사용사업주의 의무이기도 합니다.
  @Scope('admin', 'org') isDispatch: boolean;
  @Scope('admin', 'org') dispatchStartedOn: string | null;
  /** 남은 파견 가능 일수. 화면은 D-day로 보여줍니다. */
  @Scope('admin', 'org') dispatchDaysLeft: number | null;
  /** 허가번호는 운영자만. 기관 화면에 노출할 이유가 없습니다. */
  @Scope('admin') dispatchPermitNo: string | null;
}

export class ModelSpecDto {
  @Scope('admin', 'org') model: string;
  @Scope('admin', 'org') requiredDocuments: { code: string; labelKey: string; mandatory: boolean }[];
  @Scope('admin', 'org') complianceChecks: { code: string; labelKey: string; blocking: boolean }[];
  @Scope('admin') taxTreatment: string;
  @Scope('admin') revenueRecognition: string;
}

/**
 * 파견 2년 한도 현황 (파견법 §6).
 *
 * 기관도 봐야 합니다 — 한도를 넘기면 직접고용 의무가 생기는 쪽이 기관입니다.
 */
export class DispatchStatusDto {
  @Scope('admin', 'org') isDispatch: boolean;
  @Scope('admin', 'org') daysUsed: number;
  @Scope('admin', 'org') daysLeft: number;
  @Scope('admin', 'org') limitDays: number;
  /** 참이면 이미 넘겼습니다. 경고가 아니라 사고입니다. */
  @Scope('admin', 'org') exceeded: boolean;
}

// ── 근무 기록 (docs/02 §12-12.5) ────────────────────────────────────────────

export class WorkRecordDto {
  @Scope('admin', 'org') id: string;
  @Scope('admin', 'org') engagementId: string;
  @Scope('admin', 'org') sourceType: string;
  @Scope('admin', 'org') workDate: string;
  @Scope('admin', 'org') startedAt: Date | null;
  @Scope('admin', 'org') endedAt: Date | null;
  @Scope('admin', 'org') breakMinutes: number;
  @Scope('admin', 'org') normalMinutes: number;
  @Scope('admin', 'org') nightMinutes: number;
  @Scope('admin', 'org') overtimeMinutes: number;
  @Scope('admin', 'org') holidayMinutes: number;
  /** 승인 전에는 정산에 들어가지 않습니다. 집계는 자동, 확정은 사람이 합니다. */
  @Scope('admin', 'org') approvedAt: Date | null;
  /** 정정본이면 원본을 가리킵니다. 원본은 지워지지 않습니다 (§5.4). */
  @Scope('admin', 'org') correctionOf: string | null;
  @Scope('admin') approvedBy: string | null;
  @Scope('admin') sourceId: string | null;
}

export class CorrectWorkRecordDto {
  @IsInt() @Min(0) breakMinutes: number;
  @IsInt() @Min(0) normalMinutes: number;
  @IsInt() @Min(0) nightMinutes: number;
  @IsInt() @Min(0) overtimeMinutes: number;
  @IsInt() @Min(0) holidayMinutes: number;
}
