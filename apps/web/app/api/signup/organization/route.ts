import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

/** 기관 신규 등록 + 첫 담당자 신청. 둘은 한 번에 일어납니다. */
export async function POST(req: Request) {
  try {
    return NextResponse.json(await apiSend('POST', '/signup/organization', await req.json()));
  } catch (e) {
    // IAM_ORG_ALREADY_REGISTERED의 details를 그대로 넘깁니다 — 화면이
    // '이미 등록된 기관입니다, 합류를 신청하세요'로 갈아탈 수 있어야 합니다.
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
