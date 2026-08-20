import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { UserRole } from '../iam.types';
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

  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await this.db.query(`UPDATE users SET status = $2, updated_at = now() WHERE id = $1`, [userId, status]);
  }

  listRoles(userId: string): Promise<UserRoleRow[]> {
    return this.db.query<UserRoleRow>(
      `SELECT id, user_id, role, organization_id, is_primary, approved_at
         FROM user_roles WHERE user_id = $1 ORDER BY is_primary DESC, created_at`,
      [userId],
    );
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
}
