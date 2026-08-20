import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { CurrentViewer } from '../guard/viewer.decorator';
import { Public } from '../guard/jwt-auth.guard';
import {
  ConsentDto, LoginDto, MeDto, type OtpSentDto, RefreshDto, SelectRoleDto,
  SendOtpDto, TokenPairDto, UserRoleDto, VerifyOtpDto,
} from '../dto/auth.dto';
import type { AuthedRequest } from '../guard/jwt-auth.guard';
import { AuthService } from '../service/auth.service';
import { ConsentService } from '../service/consent.service';
import { UserService } from '../service/user.service';
import type { UserRoleRow, UserRow } from '../repository/user.repository';
import { ROLES_REQUIRING_ORG_APPROVAL } from '../iam.types';

/**
 * SCR-001 스플래시 · SCR-002 로그인 · SCR-003 역할 선택.
 *
 * 비밀번호 엔드포인트는 없다. S1 확정에 따라 로그인 경로는 OTP 하나뿐이고,
 * 그래서 SCREENS SCR-002의 INVALID_CREDENTIAL / LOCKED(5회 실패) 상태도 없다.
 * 대신 OTP 시도 제한이 IAM_OTP_TOO_MANY_ATTEMPTS로 같은 역할을 한다.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserService,
    private readonly consents: ConsentService,
  ) {}

  /** POST /api/v1/auth/otp/send */
  @Public()
  @Post('otp/send')
  @HttpCode(200)
  async sendOtp(@Body() dto: SendOtpDto): Promise<OtpSentDto> {
    return this.auth.sendOtp(dto.phone);
  }

  /** POST /api/v1/auth/otp/verify — 계정이 없으면 이 시점에 생성된다. */
  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: AuthedRequest): Promise<LoginDto> {
    const result = await this.auth.verifyOtp(dto.phone, dto.code, dto.deviceId ?? null, dto.locale ?? 'ko');

    // 인증에 성공한 시점부터 이 응답은 본인의 것이다. viewer를 세우지 않으면
    // ScopeInterceptor가 deny-by-default로 토큰까지 전부 잘라낸다.
    req.viewer = await this.users.buildViewer(result.user.id);

    if (dto.consents?.length) {
      await this.consents.record(
        result.user.id,
        dto.consents.map((c) => ({
          code: c.code,
          version: c.version,
          agreed: c.agreed,
          ...(c.transferCountry && c.transferRecipient
            ? { transfer: { country: c.transferCountry, recipient: c.transferRecipient } }
            : {}),
        })),
        req.ip ?? null,
      );
    }

    const out = Object.assign(new LoginDto(), {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      isNewUser: result.isNewUser,
      me: this.toMeDto(result.user, result.roles),
    });
    return out;
  }

  /** POST /api/v1/auth/refresh — 쓴 refresh 토큰은 폐기되고 새 쌍이 나온다. */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: AuthedRequest): Promise<TokenPairDto> {
    const userId = await this.auth.resolveRefreshOwner(dto.refreshToken);
    const pair = await this.auth.refresh(dto.refreshToken, dto.deviceId ?? null);
    req.viewer = await this.users.buildViewer(userId);
    return Object.assign(new TokenPairDto(), pair);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  /** GET /api/v1/auth/me — SCR-001이 토큰 유효성과 보유 역할을 확인한다. */
  @Get('me')
  async me(@CurrentViewer() viewer: Viewer): Promise<MeDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const user = await this.users.getUser(viewer.userId);
    const roles = await this.users.listRoles(viewer.userId);
    return this.toMeDto(user, roles);
  }

  /** POST /api/v1/auth/roles — SCR-003. 본인이 고를 수 있는 4종만 받는다. */
  @Post('roles')
  async selectRole(@CurrentViewer() viewer: Viewer, @Body() dto: SelectRoleDto): Promise<MeDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const roles = await this.auth.selectRole(
      viewer.userId,
      dto.role,
      dto.organizationId ?? null,
      dto.makePrimary ?? false,
    );
    const user = await this.users.getUser(viewer.userId);
    return this.toMeDto(user, roles);
  }

  @Get('consents')
  async myConsents(@CurrentViewer() viewer: Viewer): Promise<ConsentDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const rows = await this.consents.latest(viewer.userId);
    return rows.map((r) =>
      Object.assign(new ConsentDto(), {
        code: r.consent_code,
        version: r.version,
        required: r.is_required,
        agreed: r.agreed,
        agreedAt: r.agreed_at,
      }),
    );
  }

  private toMeDto(user: UserRow, roles: UserRoleRow[]): MeDto {
    const roleDtos = roles.map((r) =>
      Object.assign(new UserRoleDto(), {
        role: r.role,
        organizationId: r.organization_id,
        isPrimary: r.is_primary,
        approved: ROLES_REQUIRING_ORG_APPROVAL.includes(r.role) ? r.approved_at !== null : true,
      }),
    );
    return Object.assign(new MeDto(), {
      id: user.id,
      phone: user.phone,
      locale: user.locale,
      status: user.status,
      roles: roleDtos,
      showRoleSwitcher: roleDtos.filter((r) => r.approved).length >= 2,
      roleAssignmentState: this.users.roleAssignmentState(roles),
    });
  }
}
