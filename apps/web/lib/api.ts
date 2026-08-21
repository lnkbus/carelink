import { cookies } from 'next/headers';
import type { DomainErrorBody } from '@carelink/shared-types';

const BASE = process.env.CARELINK_API_URL ?? 'http://127.0.0.1:3000/api/v1';

/**
 * 세션 쿠키.
 *
 * 콘솔이 둘로 나뉘어 있던 동안에는 이름을 `cl_at_admin` / `cl_at_org`로 갈라
 * 두었습니다 — 쿠키가 포트를 구분하지 않아, 같은 이름이면 기관 웹에 로그인하는
 * 순간 운영 콘솔이 로그아웃됐기 때문입니다.
 *
 * 이제 둘이 한 서비스이므로 세션도 한 벌입니다. 한 사람이 운영자이면서 기관
 * 담당자일 수는 있지만, 그때도 로그인은 한 번이어야 합니다.
 *
 * 역할별 화면을 나란히 놓고 비교하려면 브라우저 프로필이나 시크릿 창을
 * 쓰세요 (앱은 포트가 다르므로 그대로 동시에 열립니다).
 */
export const ACCESS_COOKIE = 'cl_at';
export const REFRESH_COOKIE = 'cl_rt';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: DomainErrorBody,
  ) {
    super(body.code);
  }
}

/**
 * 서버 컴포넌트에서 API를 부른다.
 *
 * 토큰은 httpOnly 쿠키에만 둔다. localStorage에 두면 XSS 한 번에 운영자 세션이
 * 통째로 넘어가고, 그 세션은 전체 후보자 개인정보를 볼 수 있다 (docs/11 §5).
 *
 * 캐시하지 않는다 — 운영 콘솔에서 한 화면이라도 오래된 값을 보여주면
 * SLA 초과 건이 아직 시간이 남은 것처럼 보인다.
 */
export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';

  const res = await fetch(`${BASE}${path}${qs}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });

  const body = await res.json().catch(() => ({ code: 'COMMON_INTERNAL_ERROR', message: 'no body' }));
  if (!res.ok) throw new ApiError(res.status, body as DomainErrorBody);
  return body as T;
}

/** 서버 액션·라우트 핸들러용. */
export async function apiSend<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  payload?: unknown,
  token?: string,
): Promise<T> {
  const at = token ?? cookies().get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(at ? { authorization: `Bearer ${at}` } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body as DomainErrorBody);
  return body as T;
}

export function apiBase(): string {
  return BASE;
}
