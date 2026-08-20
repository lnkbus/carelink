import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { applyScope } from './scope.serializer';
import { ANONYMOUS, type Viewer } from './scope.types';

/**
 * 모든 응답을 viewer의 scope로 자른다. 전역 인터셉터로 등록한다.
 *
 * 컨트롤러가 DTO 인스턴스를 반환하기만 하면 필터링은 여기서 일어난다.
 * 컨트롤러에서 필드를 직접 골라 담는 코드를 쓰면 안 된다 (docs/02 §5.2).
 */
@Injectable()
export class ScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ viewer?: Viewer }>();

    return next.handle().pipe(
      map((body) => {
        // viewer는 map 안에서 읽는다. intercept() 본문은 핸들러보다 먼저 실행되므로
        // 여기서 미리 캡처하면, 인증에 성공하며 viewer를 세우는 핸들러
        // (auth/otp/verify · auth/refresh)의 갱신을 놓친다.
        const viewer = req?.viewer ?? ANONYMOUS;
        if (body === null || body === undefined) return body;
        if (Array.isArray(body)) return body.map((i) => (isPlain(i) ? i : applyScope(i as object, viewer)));
        if (isPagedResult(body)) {
          return { ...body, items: body.items.map((i) => (isPlain(i) ? i : applyScope(i as object, viewer))) };
        }
        return isPlain(body) ? body : applyScope(body as object, viewer);
      }),
    );
  }
}

/** 문자열·숫자 등 스칼라이거나 순수 리터럴 객체는 그대로 통과시킨다. */
function isPlain(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return true;
  return Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v);
}

function isPagedResult(v: unknown): v is { items: unknown[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { items?: unknown }).items);
}
