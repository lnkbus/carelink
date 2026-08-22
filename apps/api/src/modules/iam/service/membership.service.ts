import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { PENDING_APPROVAL_ROLES, type UserRole } from '../iam.types';
import { UserRepository, type PendingRoleRow, type UserRoleRow } from '../repository/user.repository';

/**
 * 소속·제휴 승인.
 *
 * ── 게이트가 둘입니다 ─────────────────────────────────────────────────
 * 헷갈리기 쉬워 여기 적어 둡니다.
 *
 *   `user_roles.approved_at`          **소속 승인** — 이 사람이 이 기관 사람이 맞나
 *   `organizations.verification_status` **기관 검증** — 이 기관이 실재하는 사업자가 맞나
 *
 * 둘은 별개이고 순서도 다릅니다. 소속 승인을 받아도 기관 검증 전에는 후보자가
 * `CD-1001` 형태로만 보입니다 (§6-6). 반대로 검증된 기관이라도 승인받지 못한
 * 사람은 아무 화면도 열지 못합니다.
 *
 * ── 누가 승인하나 ────────────────────────────────────────────────────
 *   새 기관의 **첫 담당자**  → 운영자. 기관에 관리자가 아직 없습니다.
 *                              승인하면서 `ORG_ADMIN`으로 올립니다.
 *   **두 번째 이후 담당자**  → 그 기관의 `ORG_ADMIN`.
 *                              운영자가 매번 끼면 기관이 사람을 못 늘립니다.
 *   파트너                    → 운영자. 제휴는 계약이라 기관이 자기를 못 넣습니다.
 *
 * ── 후보자·간병사·보호자는 여기 오지 않습니다 ────────────────────────
 * 본인이 고르면 그 자리에서 열립니다. 승인을 걸면 앱을 깔고 번호를 넣은
 * 사람이 아무것도 못 하는 화면에서 기다리게 되고, 그 사람은 돌아오지 않습니다.
 */
@Injectable()
export class MembershipService {
  constructor(
    private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  /**
   * 대기 목록.
   *
   * `scopeOrganizationId`가 있으면 그 기관 것만 — 기관 관리자가 남의 기관
   * 신청서를 보면 그 자체로 개인정보 유출입니다. 운영자는 null로 전체를 봅니다.
   */
  listPending(scopeOrganizationId: string | null): Promise<PendingRoleRow[]> {
    return this.users.listPendingRoles(scopeOrganizationId);
  }

  /**
   * 승인.
   *
   * `approverOrgId`가 있으면 기관 관리자입니다 — 자기 기관 신청만 승인할 수
   * 있습니다. null이면 운영자이고 제한이 없습니다.
   *
   * **첫 담당자는 `ORG_ADMIN`으로 올립니다.** 그러지 않으면 그 기관은
   * 영원히 관리자가 없어 두 번째 사람을 스스로 못 받습니다 — 운영자가
   * 모든 기관의 모든 입사자를 승인하게 되고, 그 큐는 반드시 밀립니다.
   */
  async approve(
    roleRowId: string,
    actorUserId: string,
    approverOrgId: string | null,
  ): Promise<UserRoleRow> {
    const row = await this.mustBeApprovable(roleRowId, approverOrgId);

    let role: UserRole = row.role;
    if (row.organization_id && !(await this.users.hasApprovedAdmin(row.organization_id))) {
      role = 'ORG_ADMIN';
    }

    const approved = await this.users.approveRole(roleRowId, role);
    // 동시에 두 사람이 눌렀습니다. 두 번째는 이미 승인된 것을 보게 됩니다 —
    // 오류로 만들지 않고 있는 그대로 돌려줍니다.
    if (!approved) throw new DomainError('IAM_ROLE_ALREADY_APPROVED', { roleRowId });

    await this.audit.record({
      actorUserId,
      action: 'user.role.approve',
      targetType: 'user_role',
      targetId: roleRowId,
      before: { role: row.role, approved: false },
      after: { role, approved: true, organizationId: row.organization_id },
    });
    return approved;
  }

  /**
   * 반려.
   *
   * 사유를 필수로 받습니다. 사유 없는 반려는 신청한 사람에게 '왜'를 남기지
   * 않고, 그 사람은 같은 신청을 다시 냅니다. 큐가 두 배가 됩니다.
   */
  async reject(
    roleRowId: string,
    reason: string,
    actorUserId: string,
    approverOrgId: string | null,
  ): Promise<void> {
    const row = await this.mustBeApprovable(roleRowId, approverOrgId);
    const removed = await this.users.rejectRole(roleRowId);
    if (!removed) throw new DomainError('IAM_ROLE_ALREADY_APPROVED', { roleRowId });

    // 행은 지웠지만 사실은 남깁니다 — 누가 왜 반려했는지가 분쟁의 유일한 근거입니다.
    await this.audit.record({
      actorUserId,
      action: 'user.role.reject',
      targetType: 'user_role',
      targetId: roleRowId,
      before: { role: row.role, organizationId: row.organization_id, userId: row.user_id },
      after: { rejected: true, reason },
    });
  }

  /** 승인 대상인지 + 승인할 자격이 있는지. 둘 다 여기서 막습니다. */
  private async mustBeApprovable(roleRowId: string, approverOrgId: string | null): Promise<UserRoleRow> {
    const row = await this.users.getRoleRow(roleRowId);
    if (!row) throw new DomainError('IAM_ROLE_REQUEST_NOT_FOUND', { roleRowId });
    if (row.approved_at !== null) throw new DomainError('IAM_ROLE_ALREADY_APPROVED', { roleRowId });
    if (!PENDING_APPROVAL_ROLES.includes(row.role)) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { role: row.role, reason: 'this role needs no approval' });
    }
    // 파트너를 먼저 봅니다. 파트너 신청은 organization_id가 없어서, 순서를
    // 뒤집으면 아래 '남의 기관' 규칙에 먼저 걸리고 화면에 엉뚱한 사유가 뜹니다.
    // 막히는 결과는 같지만, 승인하는 사람은 왜 막혔는지 알 수 없습니다.
    if (row.role === 'PARTNER' && approverOrgId) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { reason: 'partner approval is operator-only' });
    }
    // 기관 관리자는 자기 기관만. 남의 기관 신청서는 그 자체가 개인정보입니다.
    if (approverOrgId && row.organization_id !== approverOrgId) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { reason: 'not your organization' });
    }
    return row;
  }
}
