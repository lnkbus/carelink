import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { DomainErrorBody } from '@carelink/shared-types';

const BASE = process.env.CARELINK_API_URL ?? 'http://127.0.0.1:3000/api/v1';

/**
 * 쿠키 이름을 앱마다 다르게 둡니다.
 *
 * **쿠키는 포트를 구분하지 않습니다.** localhost:3100·3200·3400이 같은 이름을
 * 쓰면 세 앱이 세션 한 벌을 공유하고, 기관 웹에 로그인하는 순간 운영 콘솔이
 * 로그아웃됩니다. 역할별 화면을 나란히 놓고 비교할 수 없게 되는데,
 * 그 비교가 이 플랫폼에서 가장 자주 하는 확인입니다 —
 * 같은 후보자가 기관에는 익명으로, 운영자에게는 실명으로 보여야 하니까요.
 *
 * 운영에서는 도메인이 갈리므로 문제가 없지만, 이름을 나눠 두면 그때도
 * 한 브라우저에서 두 콘솔을 열 수 있습니다.
 */
export const ACCESS_COOKIE = 'cl_at_care';
export const REFRESH_COOKIE = 'cl_rt_care';

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
  method: 'POST' | 'PATCH',
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

/**
 * 서버 컴포넌트에서 안전하게 부른다.
 *
 * **401·403이 페이지 밖으로 새면 Next.js가 500 화면을 냅니다.** 사용자에게는
 * "Application error: a server-side exception has occurred"만 보이고, 원인은
 * 로그를 봐야 압니다. 실제로 보호자 홈이 그렇게 죽었습니다 — 역할이 없는
 * 계정이 `/care-requests/me/list`를 부르면 403이 그대로 올라갔습니다.
 *
 * 권한 문제는 500이 아니라 **로그인 화면 + 이유**입니다.
 */
export async function guardedGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  try {
    return await apiGet<T>(path, params);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      redirect(`/login?reason=${e.status === 403 ? 'forbidden' : 'expired'}`);
    }
    throw e;
  }
}
