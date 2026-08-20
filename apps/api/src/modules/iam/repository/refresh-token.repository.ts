import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DbService } from '../../../core/db/db.service';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  device_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
}

/** refresh 토큰은 원문을 저장하지 않는다. 유출 시 그대로 로그인에 쓰이기 때문. */
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly db: DbService) {}

  async issue(userId: string, token: string, deviceId: string | null, expiresAt: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [userId, hash(token), deviceId, expiresAt],
    );
  }

  findActive(token: string): Promise<RefreshTokenRow | null> {
    return this.db.one<RefreshTokenRow>(
      `SELECT id, user_id, device_id, expires_at, revoked_at
         FROM refresh_tokens
        WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash(token)],
    );
  }

  async revoke(token: string): Promise<void> {
    await this.db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [
      hash(token),
    ]);
  }

  /** 로그아웃 시 해당 기기의 토큰만 끊는다. 다른 기기 세션은 살려 둔다. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
      userId,
    ]);
  }
}
