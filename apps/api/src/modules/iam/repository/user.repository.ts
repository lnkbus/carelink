import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import { PENDING_APPROVAL_ROLES, type UserRole } from '../iam.types';
import type { UserStatus } from '../state/user-status.state';

export interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  locale: string;
  status: UserStatus;
  last_login_at: Date | null;
  created_at: Date;
}

/** 승인 대기 한 건 — 신청자와 기관 정보를 함께 냅니다. */
export interface PendingRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  organization_id: string | null;
  created_at: Date;
  phone: string | null;
  user_status: string;
  organization_name: string | null;
  business_reg_no: string | null;
  verification_status: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  organization_id: string | null;
  is_primary: boolean;
  approved_at: Date | null;
}

@Injectable()
export class UserRepository {
  constructor(private readonly db: DbService) {}

  findByPhone(phone: string): Promise<UserRow | null> {
    return this.db.one<UserRow>(
      `SELECT id, email, phone, locale, status, last_login_at, created_at
         FROM users WHERE phone = $1`,
      [phone],
    );
  }

  findById(id: string): Promise<UserRow | null> {
    return this.db.one<UserRow>(
      `SELECT id, email, phone, locale, status, last_login_at, created_at
         FROM users WHERE id = $1`,
      [id],
    );
  }

  /**
   * OTP 최초 인증 시 계정을 만든다. password_hash는 채우지 않는다 —
   * 로그인 경로가 OTP 하나뿐이므로(S1 확정) 비밀번호는 존재하지 않는다.
   */
  async createWithPhone(phone: string, locale: string): Promise<UserRow> {
    const row = await this.db.one<UserRow>(
      `INSERT INTO users (phone, locale) VALUES ($1, $2)
       RETURNING id, email, phone, locale, status, last_login_at, created_at`,
      [phone, locale],
    );
    return row!;
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.query(`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`, [userId]);
  }

  async updateLocale(userId: string, locale: string): Promise<void> {
    await this.db.query(`UPDATE users SET locale = $2, updated_at = now() WHERE id = $1`, [userId, locale]);
  }

  /**
   * 상태 전이.
   *
   * 탈퇴 요청 시각을 함께 찍습니다 — 파기 기준일(30일)이 여기서부터 세고,
   * 시각이 없으면 `data-retention-purge`가 대상을 고르지 못합니다.
   * 철회하면(ACTIVE 복귀) 시각을 지웁니다. 남겨 두면 다시 탈퇴했을 때
   * 이전 요청 시점부터 세어 30일을 건너뜁니다.
   */
  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await this.db.query(
      `UPDATE users
          SET status = $2::text,
              -- 같은 파라미터를 대입과 비교에 함께 쓰면 PG가 타입을 하나로
              -- 좁히지 못합니다. 명시 캐스트가 필요합니다 (F-04와 같은 부류).
              withdrawal_requested_at = CASE
                WHEN $2::text = 'WITHDRAWAL_REQUESTED' THEN now()
                WHEN $2::text = 'ACTIVE' THEN NULL
                ELSE withdrawal_requested_at
              END,
              updated_at = now()
        WHERE id = $1`,
      [userId, status],
    );
  }

  listRoles(userId: string): Promise<UserRoleRow[]> {
    return this.db.query<UserRoleRow>(
      `SELECT id, user_id, role, organization_id, is_primary, approved_at
         FROM user_roles WHERE user_id = $1 ORDER BY is_primary DESC, created_at`,
      [userId],
    );
  }

  /**
   * 기관 검증 여부. org scope 승격의 두 조건 중 하나다 (§6-6).
   *
   * iam이 organizations를 읽는 것은 §5.1의 예외다 — 뷰어 조립은 어느 도메인
   * 모듈보다 앞서 일어나고, 여기서 org 모듈을 부르면 인증이 도메인에 의존하게 된다.
   * 읽는 값은 검증 플래그 하나뿐이고 쓰기는 하지 않는다.
   */
  async isOrganizationVerified(organizationId: string): Promise<boolean> {
    const row = await this.db.one<{ verified: boolean }>(
      `SELECT (verification_status = 'VERIFIED') AS verified
         FROM organizations WHERE id = $1`,
      [organizationId],
    );
    return row?.verified ?? false;
  }

  /**
   * 역할 부여. ORG_MEMBER/ORG_ADMIN은 approved_at을 비워 승인 대기로 둔다.
   * UNIQUE(user_id, role, organization_id)라 중복은 DB가 막는다.
   */
  async addRole(
    userId: string,
    role: UserRole,
    organizationId: string | null,
    isPrimary: boolean,
    approved: boolean,
  ): Promise<UserRoleRow | null> {
    return this.db.one<UserRoleRow>(
      `INSERT INTO user_roles (user_id, role, organization_id, is_primary, approved_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END)
       ON CONFLICT (user_id, role, organization_id) DO NOTHING
       RETURNING id, user_id, role, organization_id, is_primary, approved_at`,
      [userId, role, organizationId, isPrimary, approved],
    );
  }

  async clearPrimary(userId: string): Promise<void> {
    await this.db.query(`UPDATE user_roles SET is_primary = false WHERE user_id = $1`, [userId]);
  }

  // ── 소속 승인 ────────────────────────────────────────────────────────
  //
  // `approved_at`이 NULL인 행이 곧 대기열입니다. 별도 테이블을 두지 않은
  // 이유는 승인이 상태이지 사건이 아니기 때문입니다 — 대기 행과 승인된 행이
  // 다른 테이블에 있으면 '지금 이 사람의 역할이 무엇인가'를 두 곳에서
  // 조회해야 하고, 그 둘이 어긋나는 날이 옵니다.

  /**
   * 승인 대기 목록.
   *
   * `organizationId`를 주면 그 기관 것만 — 기관 관리자는 자기 기관 사람만
   * 승인합니다. 주지 않으면 전체 (운영자).
   *
   * 신청자의 번호를 함께 냅니다. 승인하는 사람이 판단할 근거가 그것뿐입니다 —
   * 대개 전화로 확인하고 누릅니다.
   */
  listPendingRoles(organizationId: string | null): Promise<PendingRoleRow[]> {
    const where = organizationId ? 'AND r.organization_id = $1' : '';
    return this.db.query<PendingRoleRow>(
      `SELECT r.id, r.user_id, r.role, r.organization_id, r.created_at,
              u.phone, u.status AS user_status,
              o.name AS organization_name, o.business_reg_no, o.verification_status
         FROM user_roles r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN organizations o ON o.id = r.organization_id
        WHERE r.approved_at IS NULL
          AND r.role = ANY($${organizationId ? 2 : 1}::user_role[])
          ${where}
        ORDER BY r.created_at`,
      organizationId ? [organizationId, PENDING_APPROVAL_ROLES] : [PENDING_APPROVAL_ROLES],
    );
  }

  /** 승인 대상 한 건. 승인 권한을 판정하려면 어느 기관 것인지 알아야 합니다. */
  getRoleRow(roleRowId: string): Promise<UserRoleRow | null> {
    return this.db.one<UserRoleRow>(
      `SELECT id, user_id, role, organization_id, is_primary, approved_at
         FROM user_roles WHERE id = $1`,
      [roleRowId],
    );
  }

  /**
   * 승인. **이미 승인된 행은 건드리지 않습니다** — 두 번 눌러도 승인 시각이
   * 뒤로 밀리지 않습니다. 그 시각이 '언제부터 이 사람이 우리 기관 사람인가'의
   * 근거입니다.
   */
  approveRole(roleRowId: string, role: UserRole): Promise<UserRoleRow | null> {
    return this.db.one<UserRoleRow>(
      `UPDATE user_roles
          SET approved_at = now(), role = $2
        WHERE id = $1 AND approved_at IS NULL
        RETURNING id, user_id, role, organization_id, is_primary, approved_at`,
      [roleRowId, role],
    );
  }

  /**
   * 반려 — 행을 지웁니다.
   *
   * 상태 컬럼을 두지 않은 이유: 반려된 소속을 남겨 두면 `listRoles`가 그것도
   * 돌려주고, 화면마다 '반려는 빼고'를 기억해야 합니다. 한 곳이라도 잊으면
   * 반려된 사람이 기관 화면을 봅니다. 반려 사실은 audit_logs에 남습니다.
   */
  async rejectRole(roleRowId: string): Promise<boolean> {
    const rows = await this.db.query(
      `DELETE FROM user_roles WHERE id = $1 AND approved_at IS NULL RETURNING id`,
      [roleRowId],
    );
    return rows.length > 0;
  }

  /** 이 기관에 승인된 관리자가 있는가. 없으면 첫 담당자라 운영자가 승인합니다. */
  async hasApprovedAdmin(organizationId: string): Promise<boolean> {
    const row = await this.db.one<{ n: string }>(
      `SELECT count(*) AS n FROM user_roles
        WHERE organization_id = $1 AND role = 'ORG_ADMIN' AND approved_at IS NOT NULL`,
      [organizationId],
    );
    return Number(row?.n ?? 0) > 0;
  }
}
