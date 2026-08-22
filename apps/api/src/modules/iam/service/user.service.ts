import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { ScopeName, Viewer } from '../../../core/scope/scope.types';
import { needsApproval, type UserRole } from '../iam.types';
import { UserRepository, type UserRoleRow, type UserRow } from '../repository/user.repository';
import { roleAssignmentMachine, type RoleAssignmentState } from '../state/role-assignment.state';
import { userStatusMachine, type UserStatus } from '../state/user-status.state';

/**
 * 다른 모듈에 노출하는 iam 인터페이스 (docs/02 §4).
 * getUser() · hasRole() · getScope() 세 개만 외부에서 부른다.
 */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  async getUser(userId: string): Promise<UserRow> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'user', targetId: userId });
    return user;
  }

  async listRoles(userId: string): Promise<UserRoleRow[]> {
    return this.users.listRoles(userId);
  }

  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    const roles = await this.effectiveRoles(userId);
    return roles.includes(role);
  }

  /** 승인이 끝난 역할만 실제 권한으로 친다. 승인 대기 중인 기관 소속은 권한이 없다. */
  async effectiveRoles(userId: string): Promise<UserRole[]> {
    const rows = await this.users.listRoles(userId);
    return rows.filter(isEffective).map((r) => r.role);
  }

  async primaryOrganizationId(userId: string): Promise<string | null> {
    const rows = await this.users.listRoles(userId);
    const org = rows.find((r) => isEffective(r) && r.organization_id !== null);
    return org?.organization_id ?? null;
  }

  /** SCR-003 상태 판정. 역할이 없으면 NO_ROLE, 승인 대기만 있으면 PENDING_ORG_APPROVAL. */
  roleAssignmentState(rows: UserRoleRow[]): RoleAssignmentState {
    if (rows.length === 0) return roleAssignmentMachine.initial;
    if (rows.some(isEffective)) return 'ROLE_SELECTED';
    return 'PENDING_ORG_APPROVAL';
  }

  /**
   * 역할 → scope 매핑. docs/02 §5.2 · docs/11 §3.1.
   *
   * 여기서 'org'(실명·연락처 노출)를 주지 않는다는 점이 중요하다.
   * 기관은 검증 완료 + 후보자의 면접 수락이라는 두 조건을 통과한 뒤에야
   * 해당 후보자에 한해 'org'로 올라간다 — 그 판정은 리소스를 아는
   * matching/talent 쪽에서 내리고, 여기서는 기본값으로 'org_masked'만 준다.
   */
  toScopes(roles: UserRole[]): ScopeName[] {
    // 'self'는 여기서 주지 않는다. 역할이 아니라 "이 레코드가 내 것인가"라는
    // 관계이므로, DTO의 @ScopeOwner 값과 viewer.userId가 일치할 때
    // 직렬화 시점에 부여된다 (core/scope/scope.serializer.ts).
    // 인증된 사용자면 누구나 보는 값(기관명, 트랙 라벨 등)에 쓴다.
    // 개인정보는 여기 걸지 않는다 — 이 scope는 사실상 '로그인한 전원'이다.
    const scopes = new Set<ScopeName>(['public']);
    for (const role of roles) {
      switch (role) {
        case 'ADMIN':
        case 'SUPER_ADMIN':
          scopes.add('admin');
          break;
        case 'ORG_MEMBER':
        case 'ORG_ADMIN':
          scopes.add('org_masked');
          break;
        case 'CAREGIVER':
          scopes.add('caregiver');
          break;
        case 'PARTNER':
          scopes.add('partner');
          break;
        default:
          break;
      }
    }
    return [...scopes];
  }

  async buildViewer(userId: string): Promise<Viewer> {
    const user = await this.getUser(userId);
    if (user.status === 'SUSPENDED') throw new DomainError('IAM_USER_SUSPENDED');
    const roles = await this.effectiveRoles(userId);
    const organizationId = await this.primaryOrganizationId(userId);
    return {
      userId: user.id,
      roles,
      scopes: this.toScopes(roles),
      organizationId,
      // 검증 전 기관은 후보자 개인정보를 볼 수 없다 (§6-6). 요청 전체에 걸쳐
      // 같은 값이므로 뷰어 조립 시점에 한 번만 확인한다.
      organizationVerified: organizationId ? await this.users.isOrganizationVerified(organizationId) : false,
      locale: user.locale,
    };
  }

  async changeStatus(userId: string, to: UserStatus): Promise<void> {
    const user = await this.getUser(userId);
    userStatusMachine.assert(user.status, to);
    await this.users.updateStatus(userId, to);
  }
}

function isEffective(row: UserRoleRow): boolean {
  return needsApproval(row.role) ? row.approved_at !== null : true;
}
