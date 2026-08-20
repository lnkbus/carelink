import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

export class NextActionDto {
  @Scope('self', 'admin') code: string;
  @Scope('self', 'admin') screen: string;
  @Scope('self', 'admin') params: Record<string, unknown>;
  @Scope('self', 'admin') reasonKey: string;
}

export class JourneyGroupDto {
  @Scope('self', 'admin', 'org') key: string;
  @Scope('self', 'admin', 'org') labelKey: string;
  @Scope('self', 'admin', 'org') state: string;
  @Scope('admin') steps: readonly string[];
}

export class JourneyStepDto {
  @Scope('self', 'admin', 'org') step: string;
  @Scope('self', 'admin', 'org') enteredAt: Date;
  @Scope('self', 'admin') note: string | null;
}

export class VisaProcessStepDto {
  @Scope('self', 'admin') step: string;
  @Scope('self', 'admin') enteredAt: Date;
  @Scope('self', 'admin') reason: string | null;
  @Scope('self', 'admin') note: string | null;
}

/**
 * 체류자격 절차 (S3의 두 번째 축).
 * 기관에는 나가지 않는다 — 체류자격 관련 정보는 '취업 가능 여부'로만 치환된다 (§6-12).
 */
export class VisaProcessDto {
  @Scope('self', 'admin') applicable: boolean;
  @Scope('self', 'admin') requiresEntry: boolean;
  @Scope('self', 'admin') targetVisaCode: string | null;
  @Scope('self', 'admin') currentStep: string | null;
  @Scope('self', 'admin') complete: boolean;
  @Scope('self', 'admin') reasonKey: string;
  @Scope('self', 'admin') history: VisaProcessStepDto[];
}

export class JourneyDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org') currentStep: string;
  @Scope('self', 'admin', 'org') progress: { current: number; total: number };
  @Scope('self', 'admin', 'org') groups: JourneyGroupDto[];
  @Scope('self', 'admin', 'org') history: JourneyStepDto[];
  /** SCR-101의 단일 카드. 없으면 화면은 추천 일자리를 주 카드로 올린다. */
  @Scope('self', 'admin') nextAction: NextActionDto | null;
  @Scope('self', 'admin') visaProcess: VisaProcessDto | null;
}

const JOURNEY_STEPS = ['APPLIED','PROFILE_REGISTERED','DOC_REVIEW','TRAINING','READY','MATCHED','INTERVIEW','PLACED','ACTIVE'] as const;
const VISA_STEPS = ['CONTRACT_SIGNED','DOCUMENT_REVIEW','APPLICATION_SUBMITTED','APPROVED','ENTERED','REJECTED','WITHDRAWN'] as const;

export class AdvanceJourneyDto {
  @IsIn(JOURNEY_STEPS) step: (typeof JOURNEY_STEPS)[number];
  @IsOptional() @IsString() @Length(1, 500) note?: string;
}

export class AdvanceVisaProcessDto {
  @IsIn(VISA_STEPS) step: (typeof VISA_STEPS)[number];
  @IsOptional() @IsString() @Length(1, 16) targetVisaCode?: string;
  /** REJECTED에는 사유가 반드시 있어야 한다. */
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
  @IsOptional() @IsString() @Length(1, 500) note?: string;
}

export class EnrollDto {
  @IsString() @Length(1, 64) programCode: string;
}

export class UpdateProgressDto {
  @IsNumber() @Min(0) @Max(100) progressRate: number;
  @IsOptional() @IsString() certificateKey?: string;
}

export class TrainingProgramDto {
  @Scope('self', 'admin', 'org', 'partner') code: string;
  @Scope('self', 'admin', 'org', 'partner') name: string;
  @Scope('self', 'admin', 'org', 'partner') programType: string;
  @Scope('self', 'admin', 'org', 'partner') totalHours: number | null;
  @Scope('self', 'admin', 'org', 'partner') isMandatory: boolean;
}

export class EnrollmentDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org', 'partner') id: string;
  @Scope('self', 'admin', 'org', 'partner') programCode: string;
  @Scope('self', 'admin', 'org', 'partner') programName: string;
  @Scope('self', 'admin', 'org', 'partner') programType: string;
  @Scope('self', 'admin', 'org', 'partner') status: string;
  @Scope('self', 'admin', 'org', 'partner') progressRate: number;
  @Scope('self', 'admin', 'org', 'partner') totalHours: number | null;
  @Scope('self', 'admin', 'org', 'partner') completedAt: Date | null;
  /** 수료증 파일도 presigned URL로만 접근한다. 키는 노출하지 않는다. */
  certificateKey: string | null;
}
