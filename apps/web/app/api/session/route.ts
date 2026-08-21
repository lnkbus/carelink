import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, apiBase } from '@/lib/api';

/**
 * OTP 로그인 → 토큰을 httpOnly 쿠키에 심는다.
 *
 * 토큰이 브라우저 JS에 노출되면 XSS 한 번으로 운영자 세션이 넘어가고,
 * 그 세션은 전체 후보자의 실명·연락처·체류자격을 볼 수 있다 (docs/11 §5).
 * 그래서 클라이언트는 토큰을 아예 만지지 않는다.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const res = await fetch(`${apiBase()}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  // 로그인 직후 어디로 보낼지도 같이 내려보냅니다. 역할 판정을 브라우저에
  // 넘기면 승인되지 않은 소속까지 내려보내게 됩니다 (lib/session.ts landingFor).
  const roles: { role: string; approved: boolean }[] = data.me?.roles ?? [];
  const has = (...want: string[]) => roles.some((r) => r.approved && want.includes(r.role));
  const landing = has('ADMIN', 'SUPER_ADMIN')
    ? '/admin'
    : has('ORG_MEMBER', 'ORG_ADMIN')
      ? '/org'
      : '/no-access';

  const out = NextResponse.json({ me: data.me, landing });
  const secure = process.env.NODE_ENV === 'production';
  // Access 15m / Refresh 14d — docs/02 §9.1
  out.cookies.set(ACCESS_COOKIE, data.accessToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 15 * 60,
  });
  out.cookies.set(REFRESH_COOKIE, data.refreshToken, {
    httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 14 * 24 * 60 * 60,
  });
  return out;
}

/**
 * 로그아웃.
 *
 * 쿠키만 지우면 **로그아웃한 척**입니다. refresh 토큰은 14일짜리라, 그 사이에
 * 어디선가 새어 나간 값이 그대로 로그인에 쓰입니다. 서버에서 먼저 폐기하고
 * 그 다음에 쿠키를 지웁니다.
 *
 * 폐기가 실패해도 쿠키는 지웁니다 — 여기서 멈추면 사용자는 로그아웃 버튼이
 * 아무 반응도 없는 화면에 갇힙니다. 계정을 바꿔 가며 테스트할 때 이게 막히면
 * 브라우저 저장소를 손으로 뒤지게 됩니다.
 */
export async function DELETE() {
  const refresh = cookies().get(REFRESH_COOKIE)?.value;
  if (refresh) {
    await fetch(`${apiBase()}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => undefined);
  }

  const out = NextResponse.json({ ok: true });
  out.cookies.delete(ACCESS_COOKIE);
  out.cookies.delete(REFRESH_COOKIE);
  return out;
}
