import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DomainError } from '../../../core/errors/domain-error';
import { ANONYMOUS, type Viewer } from '../../../core/scope/scope.types';
import { TokenService } from '../service/token.service';
import { UserService } from '../service/user.service';

export const IS_PUBLIC = 'carelink:isPublic';
/** 인증 없이 열어 둘 엔드포인트. OTP 발송·검증·리프레시만 해당한다. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthedRequest extends Request {
  viewer: Viewer;
}

/**
 * 토큰을 검증하고 req.viewer를 채운다.
 * ScopeInterceptor가 이 viewer로 응답 필드를 자르므로, 여기서 viewer가 비면
 * 아무 필드도 나가지 않는다 — deny by default가 자연스럽게 성립한다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      req.viewer = ANONYMOUS;
      if (isPublic) return true;
      // 토큰이 없는 것은 권한 부족(403)이 아니라 미인증(401)이다.
      // 클라이언트가 재로그인과 권한 오류를 구분할 수 있어야 한다.
      throw new DomainError('IAM_TOKEN_INVALID');
    }

    const payload = await this.tokens.verifyAccess(token);
    req.viewer = await this.users.buildViewer(payload.sub);
    return true;
  }
}
