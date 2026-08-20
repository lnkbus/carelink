import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

/** 브라우저가 API 토큰을 만지지 않도록 서버에서 중계한다. */
export async function POST(req: Request) {
  try {
    return NextResponse.json(await apiSend('POST', '/admin/scope-scan', await req.json()));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
