import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
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
}

export class ModelSpecDto {
  @Scope('admin', 'org') model: string;
  @Scope('admin', 'org') requiredDocuments: { code: string; labelKey: string; mandatory: boolean }[];
  @Scope('admin', 'org') complianceChecks: { code: string; labelKey: string; blocking: boolean }[];
  @Scope('admin') taxTreatment: string;
  @Scope('admin') revenueRecognition: string;
}
