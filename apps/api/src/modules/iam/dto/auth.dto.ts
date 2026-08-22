import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';
import { CONSENT_CODES, SELF_SELECTABLE_ROLES, SUPPORTED_LOCALES, type ConsentCode, type Locale, type SelfSelectableRole } from '../iam.types';

export class SendOtpDto {
  /** 국내 번호 기준. 하이픈·공백은 서버에서 제거한다. */
  @IsString() @Matches(/^[\d\s+-]{9,20}$/) phone: string;
}

export class ConsentInputDto {
  @IsIn(Object.keys(CONSENT_CODES)) code: ConsentCode;
  @IsString() @Length(1, 32) version: string;
  @IsBoolean() agreed: boolean;
  @IsOptional() @IsString() transferCountry?: string;
  @IsOptional() @IsString() transferRecipient?: string;
}

export class VerifyOtpDto {
  @IsString() @Matches(/^[\d\s+-]{9,20}$/) phone: string;
  @IsString() @Length(6, 6) code: string;
  @IsOptional() @IsString() @Length(1, 128) deviceId?: string;
  @IsOptional() @IsIn(SUPPORTED_LOCALES) locale?: Locale;

  /**
   * 최초 로그인 시 함께 받는 동의. 항목별로 분리된 배열이어야 한다 —
   * 일괄 체크 하나로 받으면 그 동의는 무효다 (docs/11 §2.3).
   */
  @IsOptional() @ValidateNested({ each: true }) @Type(() => ConsentInputDto) consents?: ConsentInputDto[];
}

export class RefreshDto {
  @IsString() refreshToken: string;
  @IsOptional() @IsString() deviceId?: string;
}

export class SelectRoleDto {
  @IsIn(SELF_SELECTABLE_ROLES) role: SelfSelectableRole;
  /** ORG_MEMBER일 때만 필수. 승인 전까지 PENDING_ORG_APPROVAL로 남는다. */
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsBoolean() makePrimary?: boolean;
}

// ── 응답 DTO ────────────────────────────────────────────────────────────────

export class UserRoleDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin') role: string;
  @Scope('self', 'admin') organizationId: string | null;
  @Scope('self', 'admin') isPrimary: boolean;
  /** SCR-003의 PENDING_ORG_APPROVAL 판정에 쓴다. */
  @Scope('self', 'admin') approved: boolean;
}

export class MeDto {
  /** 이 레코드의 주인. self scope 판정에만 쓰이고 응답에는 나가지 않는다. */
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin') id: string;
  /** [PII] 본인과 운영자만. 기관은 어떤 단계에서도 users.phone을 보지 않는다. */
  @Scope('self', 'admin') phone: string | null;
  @Scope('self', 'admin') locale: string;
  @Scope('self', 'admin') status: string;
  @Scope('self', 'admin') roles: UserRoleDto[];
  /** 역할 2개 이상이면 홈 앱바에 역할 스위처를 띄운다 (SCR-003 notes). */
  @Scope('self', 'admin') showRoleSwitcher: boolean;
  @Scope('self', 'admin') roleAssignmentState: string;
}

export class TokenPairDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self') accessToken: string;
  @Scope('self') refreshToken: string;
  @Scope('self') expiresIn: string;
}

export class LoginDto extends TokenPairDto {
  @Scope('self') isNewUser: boolean;
  @Scope('self') me: MeDto;
}

/**
 * OTP 발송 응답. 인증 이전이라 viewer가 없고, 담긴 값도 개인정보가 아니다.
 * @Scope를 붙이면 deny-by-default에 걸려 빈 객체가 나가므로 일반 객체로 둔다.
 */
export interface OtpSentDto {
  expiresInSeconds: number;
  /** 개발 환경에서만 채워진다. 운영에서는 키 자체가 없다. */
  devCode?: string;
}

export class ConsentDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin') code: string;
  @Scope('self', 'admin') version: string;
  @Scope('self', 'admin') required: boolean;
  @Scope('self', 'admin') agreed: boolean;
  @Scope('self', 'admin') agreedAt: Date;
}

// ── 가입 신청 · 승인 ───────────────────────────────────────────────────

/**
 * 기관 신규 등록 신청.
 *
 * 사업자등록번호가 필수입니다 — 이게 없으면 운영자가 검증할 대상이 없고,
 * 같은 기관인지 판별할 열쇠도 없습니다.
 */
export class RegisterOrganizationDto {
  @IsString() @Length(2, 200) name: string;
  @IsUUID() industryId: string;
  @IsString() @Length(2, 40) orgType: string;
  @IsString() @Length(10, 20) businessRegNo: string;
  @IsOptional() @IsString() @Length(1, 120) region?: string;
  @IsOptional() @IsString() @Length(1, 300) address?: string;
  @IsOptional() @IsString() @Length(1, 120) contactName?: string;
  @IsOptional() @IsString() @Length(1, 32) contactPhone?: string;
}

/** 기존 기관 합류 신청. 사업자등록번호로 찾습니다. */
export class JoinOrganizationDto {
  @IsString() @Length(10, 20) businessRegNo: string;
}

/** 반려 — 사유가 필수입니다. 사유 없는 반려는 같은 신청을 다시 부릅니다. */
export class DecideRoleRequestDto {
  @IsIn(['APPROVE', 'REJECT']) decision: 'APPROVE' | 'REJECT';
  @IsOptional() @IsString() @Length(1, 500) reason?: string;
}

/**
 * 승인 대기 한 건.
 *
 * 신청자 번호는 운영자와 그 기관의 관리자에게만 나갑니다. 승인하는 사람이
 * 판단할 근거가 그것뿐입니다 — 대개 전화로 확인하고 누릅니다.
 */
export class PendingRoleDto {
  // scope는 'org'가 아니라 **'org_masked'** 입니다. 헷갈리기 쉬워 적어 둡니다 —
  // 'org'는 역할이 아니라 관계이고(검증 완료 + 후보자의 면접 수락), 후보자
  // 개인정보에만 붙습니다. 기관 담당자가 평소에 들고 있는 것은 'org_masked'라,
  // 여기에 'org'를 적으면 **기관 관리자 승인 큐가 빈 화면으로 나옵니다.**
  // 실제로 그렇게 나왔고 그래서 고쳤습니다.
  @Scope('admin', 'org_masked') id: string;
  @Scope('admin', 'org_masked') role: string;
  @Scope('admin', 'org_masked') requestedAt: Date;
  @Scope('admin', 'org_masked') phone: string | null;
  @Scope('admin', 'org_masked') organizationId: string | null;
  @Scope('admin', 'org_masked') organizationName: string | null;
  // 운영자 전용입니다. 기관 관리자에게는 자기 기관의 번호라 승인 판단에
  // 보탬이 되지 않고, 운영자 큐에서는 사업자등록증과 대조하는 값입니다.
  @Scope('admin') businessRegNo: string | null;
  @Scope('admin', 'org_masked') verificationStatus: string | null;
  /** 승인하면 관리자가 되는가 — 그 기관의 첫 담당자입니다. */
  @Scope('admin', 'org_masked') becomesAdmin: boolean;
}
