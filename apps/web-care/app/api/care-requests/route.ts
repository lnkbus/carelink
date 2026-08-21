import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

/**
 * 클라이언트 → 서버 라우트 → API.
 *
 * 브라우저가 직접 API를 부르지 않습니다. 토큰이 httpOnly 쿠키에만 있고,
 * 그 쿠키는 이 라우트에서만 읽힙니다 (docs/11 §5).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json(await apiSend('POST', '/care-requests', body));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
