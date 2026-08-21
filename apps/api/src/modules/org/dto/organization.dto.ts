import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { Scope, ScopeUnlock } from '../../../core/scope/scope.decorator';

const VERIFICATION = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'] as const;
const E7_STATUS = ['NOT_REVIEWED', 'ELIGIBLE', 'INELIGIBLE', 'CONDITIONAL'] as const;

export class CreateOrganizationDto {
  @IsString() @Length(1, 200) name: string;
  @IsUUID() industryId: string;
  @IsString() @Length(1, 48) orgType: string;
  @IsOptional() @IsString() @Length(1, 32) businessRegNo?: string;
  @IsOptional() @IsString() @Length(1, 300) address?: string;
  @IsOptional() @IsString() @Length(1, 120) region?: string;
  @IsOptional() @IsString() @Length(1, 120) contactName?: string;
  @IsOptional() @IsString() @Length(1, 32) contactPhone?: string;
}

export class UpdateOrganizationDto {
  @IsOptional() @IsString() @Length(1, 200) name?: string;
  @IsOptional() @IsString() @Length(1, 300) address?: string;
  @IsOptional() @IsString() @Length(1, 120) region?: string;
  @IsOptional() @IsString() @Length(1, 120) contactName?: string;
  @IsOptional() @IsString() @Length(1, 32) contactPhone?: string;
  @IsOptional() @IsInt() @Min(0) domesticEmployees?: number;
  @IsOptional() @IsBoolean() dormitoryProvided?: boolean;
  @IsOptional() @IsBoolean() koreanSupportStaff?: boolean;
}

export class VerifyOrganizationDto {
  @IsIn(VERIFICATION) status: (typeof VERIFICATION)[number];
}

export class E7SponsorDto {
  @IsIn(E7_STATUS) status: (typeof E7_STATUS)[number];
  @IsOptional() @IsString() @Length(1, 1000) note?: string;
}

export class OrganizationQueryDto {
  @IsOptional() @IsIn(VERIFICATION) status?: (typeof VERIFICATION)[number];
  @IsOptional() @IsString() region?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) size?: number;
}

/**
 * 기관 정보.
 *
 * 담당자 연락처는 후보자에게 나가지 않는다 — 기관↔후보자 직접 연결 경로는
 * 플랫폼이 통제하는 하나뿐이어야 한다 (docs/02 §14-4).
 */
export class OrganizationDto {
  /**
   * 요청자가 이 기관의 승인된 소속인가. 참이면 org로 승격돼 사업자번호·담당자
   * 연락처가 열린다.
   *
   * 'org' scope는 "이 리소스에 대해 권한이 열린 기관"을 뜻한다. 기관 자신에게는
   * 소속 여부가, 후보자 프로필에는 검증 완료 + 면접 수락이 그 조건이다.
   * 조건은 리소스마다 다르므로 판정은 서비스가 하고 강제는 직렬화가 한다.
   */
  @ScopeUnlock('org') isOwnOrganization: boolean;

  // 후보자도 일자리 목록·상세(SCR-107·108)에서 기관명과 근무 조건을 본다.
  // 기관은 사용자의 소유물이 아니므로 self가 아니라 public이다.
  @Scope('public', 'admin', 'org', 'org_masked') id: string;
  @Scope('public', 'admin', 'org', 'org_masked') name: string;
  @Scope('public', 'admin', 'org', 'org_masked') orgType: string;
  @Scope('public', 'admin', 'org', 'org_masked') region: string | null;
  @Scope('public', 'admin', 'org', 'org_masked') verificationStatus: string;
  @Scope('public', 'admin', 'org', 'org_masked') dormitoryProvided: boolean;
  @Scope('public', 'admin', 'org', 'org_masked') koreanSupportStaff: boolean;

  /** [PII 준함] 소속 기관 담당자와 운영자만. */
  @Scope('admin', 'org') businessRegNo: string | null;
  @Scope('admin', 'org') address: string | null;
  @Scope('admin', 'org') contactName: string | null;
  @Scope('admin', 'org') contactPhone: string | null;
  @Scope('admin', 'org') verifiedAt: Date | null;
  @Scope('admin', 'org') domesticEmployees: number | null;

  /** E-7-2 적격성 판정은 운영자 전용이다. */
  @Scope('admin') e7SponsorStatus: string;
  @Scope('admin') e7ReviewedAt: Date | null;
  @Scope('admin') e7ReviewNote: string | null;
  @Scope('admin') contractType: string | null;
}

/**
 * 채용 퍼널 한 줄.
 *
 * **`org_masked`도 봅니다.** 여기엔 후보자 개인정보가 한 톨도 없습니다 —
 * 트랙 코드와 단계와 인원수뿐이고, 전부 그 기관 자신의 집계입니다.
 *
 * 종전에는 `org`만 두었습니다. 그런데 `org`는 역할이 아니라 **관계**라서
 * (검증 완료 + 후보자의 면접 수락 이후) 기관 담당자는 평소에 `org_masked`만
 * 갖습니다. 그래서 이 응답이 계속 `[{},{},{}]`로 나갔고, 대시보드의 퍼널이
 * 조용히 비어 있었습니다 — 오류도 없이.
 */
export class OrgFunnelRowDto {
  @Scope('admin', 'org', 'org_masked') trackCode: string;
  @Scope('admin', 'org', 'org_masked') stage: string;
  @Scope('admin', 'org', 'org_masked') count: number;
}

export class PagedOrganizationsDto {
  @Scope('public', 'admin', 'org', 'org_masked') items: OrganizationDto[];
  @Scope('public', 'admin', 'org', 'org_masked') total: number;
  @Scope('public', 'admin', 'org', 'org_masked') page: number;
  @Scope('public', 'admin', 'org', 'org_masked') size: number;
}
