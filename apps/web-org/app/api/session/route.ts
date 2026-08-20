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

  const out = NextResponse.json({ me: data.me });
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

export async function DELETE() {
  const out = NextResponse.json({ ok: true });
  out.cookies.delete(ACCESS_COOKIE);
  out.cookies.delete(REFRESH_COOKIE);
  return out;
}
