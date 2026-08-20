import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

export async function POST(_req: Request, { params }: { params: { jobId: string } }) {
  try {
    return NextResponse.json(await apiSend('POST', `/jobs/${params.jobId}/matches`));
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
