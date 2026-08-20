import { lastValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Scope } from './scope.decorator';
import { ScopeInterceptor } from './scope.interceptor';
import type { Viewer } from './scope.types';

class TokenDto {
  @Scope('self') accessToken: string;
}

function contextFor(req: { viewer?: Viewer }): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

describe('ScopeInterceptor', () => {
  const interceptor = new ScopeInterceptor();

  it('viewer가 없으면 scope 대상 필드를 모두 제거한다', async () => {
    const body = Object.assign(new TokenDto(), { accessToken: 'jwt' });
    const out = await lastValueFrom(
      interceptor.intercept(contextFor({}), { handle: () => of(body) } as CallHandler),
    );
    expect(out).toEqual({});
  });

  it('핸들러가 실행 중에 세운 viewer를 반영한다', async () => {
    // auth/otp/verify는 인증에 성공한 뒤에야 viewer를 알 수 있다.
    // 인터셉터가 핸들러 실행 전에 viewer를 캡처하면 토큰까지 잘려 나간다.
    const req: { viewer?: Viewer } = {};
    const handler: CallHandler = {
      handle: () => {
        req.viewer = { userId: 'u1', roles: ['CANDIDATE'], scopes: ['self'], locale: 'ko' };
        return of(Object.assign(new TokenDto(), { accessToken: 'jwt' }));
      },
    };
    const out = await lastValueFrom(interceptor.intercept(contextFor(req), handler));
    expect(out).toEqual({ accessToken: 'jwt' });
  });

  it('순수 리터럴 객체는 그대로 통과시킨다', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(contextFor({}), { handle: () => of({ expiresInSeconds: 180 }) } as CallHandler),
    );
    expect(out).toEqual({ expiresInSeconds: 180 });
  });
});
