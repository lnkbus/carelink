import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

/**
 * 일괄 처리 프록시.
 *
 * 브라우저가 API를 직접 부르지 않습니다 — 토큰이 httpOnly 쿠키에만 있고,
 * 그건 XSS 한 번으로 운영자 세션이 넘어가지 않게 하려는 것입니다 (docs/11 §5).
 * 그래서 서버 라우트가 쿠키를 읽어 대신 부릅니다.
 */
export async function POST(req: Request) {
  const body = await req.json();
  try {
    return NextResponse.json(await apiSend('POST', '/admin/candidates/bulk', body));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
