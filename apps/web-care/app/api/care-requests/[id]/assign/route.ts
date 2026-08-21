import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    return NextResponse.json(await apiSend('POST', `/care-requests/${params.id}/assign`, body));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
