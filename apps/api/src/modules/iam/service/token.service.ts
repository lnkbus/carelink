import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { DomainError } from '../../../core/errors/domain-error';
import { RefreshTokenRepository } from '../repository/refresh-token.repository';
import type { UserRole } from '../iam.types';

export interface AccessTokenPayload {
  sub: string;
  roles: UserRole[];
  /** ORG_MEMBER/ORG_ADMIN의 승인 완료된 소속 기관. scope 판정 입력값. */
  orgId: string | null;
  locale: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** docs/02 §2 — Access 15m / Refresh 14d. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly refreshRepo: RefreshTokenRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async issuePair(payload: AccessTokenPayload, deviceId: string | null): Promise<TokenPair> {
    const ttl = this.config.get<string>('ACCESS_TOKEN_TTL')!;
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: ttl });

    // refresh는 JWT가 아니라 불투명 난수다. 해시만 저장하므로 서버에서 즉시 폐기할 수 있다.
    const refreshToken = randomBytes(48).toString('base64url');
    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS')!;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.refreshRepo.issue(payload.sub, refreshToken, deviceId, expiresAt);

    return { accessToken, refreshToken, expiresIn: ttl };
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch (err) {
      const expired = err instanceof Error && err.name === 'TokenExpiredError';
      throw new DomainError(expired ? 'IAM_TOKEN_EXPIRED' : 'IAM_TOKEN_INVALID');
    }
  }

  /**
   * refresh 회전. 쓴 토큰은 즉시 폐기하고 새 쌍을 낸다.
   * 재사용을 허용하면 탈취된 토큰이 만료까지 계속 살아 있다.
   */
  async rotate(refreshToken: string, payload: AccessTokenPayload, deviceId: string | null): Promise<TokenPair> {
    const row = await this.refreshRepo.findActive(refreshToken);
    if (!row || row.user_id !== payload.sub) throw new DomainError('IAM_TOKEN_INVALID');
    await this.refreshRepo.revoke(refreshToken);
    return this.issuePair(payload, deviceId ?? row.device_id);
  }

  async resolveUserIdFromRefresh(refreshToken: string): Promise<string> {
    const row = await this.refreshRepo.findActive(refreshToken);
    if (!row) throw new DomainError('IAM_TOKEN_INVALID');
    return row.user_id;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.refreshRepo.revoke(refreshToken);
  }
}
