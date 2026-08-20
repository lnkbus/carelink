import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Scope } from '../../../core/scope/scope.decorator';
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
  @Scope('self', 'admin') role: string;
  @Scope('self', 'admin') organizationId: string | null;
  @Scope('self', 'admin') isPrimary: boolean;
  /** SCR-003의 PENDING_ORG_APPROVAL 판정에 쓴다. */
  @Scope('self', 'admin') approved: boolean;
}

export class MeDto {
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
  @Scope('self', 'admin') code: string;
  @Scope('self', 'admin') version: string;
  @Scope('self', 'admin') required: boolean;
  @Scope('self', 'admin') agreed: boolean;
  @Scope('self', 'admin') agreedAt: Date;
}
