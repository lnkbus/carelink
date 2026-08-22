import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

/**
 * 승인 · 반려.
 *
 * 운영자인지 기관 관리자인지 여기서 가르지 않습니다 — 토큰만 넘기고 API가
 * 판정합니다. 웹에서 한 번 더 판정하면 두 판정이 어긋나는 날이 옵니다.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await apiSend('PATCH', `/role-requests/${params.id}`, await req.json()));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
