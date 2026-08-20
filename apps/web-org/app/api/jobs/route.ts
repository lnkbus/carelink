import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

export async function POST(req: Request) {
  try {
    return NextResponse.json(await apiSend('POST', '/jobs', await req.json()));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
