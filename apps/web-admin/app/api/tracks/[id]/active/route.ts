import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(
      await apiSend('PATCH', `/admin/tracks/${params.id}/active`, await req.json()),
    );
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
