import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { SELF_SELECTABLE_ROLES, SUPPORTED_LOCALES, type Locale, type SelfSelectableRole, type UserRole, ROLES_REQUIRING_ORG_APPROVAL } from '../iam.types';
import { UserRepository, type UserRoleRow, type UserRow } from '../repository/user.repository';
import { OtpService } from './otp.service';
import { TokenService, type TokenPair } from './token.service';
import { UserService } from './user.service';
import { normalizePhone } from './phone';

export interface LoginResult extends TokenPair {
  user: UserRow;
  roles: UserRoleRow[];
  /** 신규 가입이면 true — 클라이언트는 SCR-003(역할 선택)으로 보낸다. */
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly userService: UserService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** SCR-002 — 번호를 입력하면 인증 문자를 보낸다. 비밀번호는 존재하지 않는다(S1). */
  async sendOtp(phone: string): Promise<{ expiresInSeconds: number; devCode?: string }> {
    return this.otp.issue(normalizePhone(phone));
  }

  /**
   * OTP 검증 → 로그인. 계정이 없으면 이 시점에 만든다.
   * 별도의 회원가입 화면이 없는 것은 입력 최소화 원칙 때문이다 (docs/09 §4.2).
   */
  async verifyOtp(rawPhone: string, code: string, deviceId: string | null, locale: Locale): Promise<LoginResult> {
    const phone = normalizePhone(rawPhone);
    await this.otp.verify(phone, code);

    let user = await this.users.findByPhone(phone);
    const isNewUser = user === null;
    if (!user) {
      user = await this.users.createWithPhone(phone, SUPPORTED_LOCALES.includes(locale) ? locale : 'ko');
    }
    if (user.status === 'SUSPENDED') throw new DomainError('IAM_USER_SUSPENDED');

    await this.users.touchLastLogin(user.id);
    const roles = await this.users.listRoles(user.id);
    const pair = await this.tokens.issuePair(
      {
        sub: user.id,
        roles: await this.userService.effectiveRoles(user.id),
        orgId: await this.userService.primaryOrganizationId(user.id),
        locale: user.locale,
      },
      deviceId,
    );

    await this.audit.record({
      actorUserId: user.id,
      action: isNewUser ? 'user.signup' : 'user.login',
      targetType: 'user',
      targetId: user.id,
    });

    return { ...pair, user, roles, isNewUser };
  }

  async refresh(refreshToken: string, deviceId: string | null): Promise<TokenPair> {
    const userId = await this.tokens.resolveUserIdFromRefresh(refreshToken);
    const user = await this.userService.getUser(userId);
    if (user.status === 'SUSPENDED') throw new DomainError('IAM_USER_SUSPENDED');

    return this.tokens.rotate(
      refreshToken,
      {
        sub: user.id,
        roles: await this.userService.effectiveRoles(user.id),
        orgId: await this.userService.primaryOrganizationId(user.id),
        locale: user.locale,
      },
      deviceId,
    );
  }

  /** 응답 scope를 세우기 위해 회전 전에 소유자를 먼저 확인한다. */
  async resolveRefreshOwner(refreshToken: string): Promise<string> {
    return this.tokens.resolveUserIdFromRefresh(refreshToken);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  /**
   * SCR-003 — 역할 선택. 본인이 고를 수 있는 것은 4종뿐이다(S2).
   * ORG_MEMBER는 기관 관리자 승인 전까지 PENDING이라 권한이 붙지 않는다.
   */
  async selectRole(
    userId: string,
    role: SelfSelectableRole,
    organizationId: string | null,
    makePrimary: boolean,
  ): Promise<UserRoleRow[]> {
    if (!SELF_SELECTABLE_ROLES.includes(role)) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { role, selectable: SELF_SELECTABLE_ROLES });
    }
    const needsApproval = ROLES_REQUIRING_ORG_APPROVAL.includes(role as UserRole);
    if (needsApproval && !organizationId) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { role, reason: 'organizationId is required for organization roles' });
    }

    if (makePrimary) await this.users.clearPrimary(userId);
    const created = await this.users.addRole(userId, role, organizationId, makePrimary, !needsApproval);
    if (!created) throw new DomainError('IAM_ROLE_ALREADY_HELD', { role });

    await this.audit.record({
      actorUserId: userId,
      action: 'user.role.add',
      targetType: 'user',
      targetId: userId,
      after: { role, organizationId, approved: !needsApproval },
    });

    return this.users.listRoles(userId);
  }
}
