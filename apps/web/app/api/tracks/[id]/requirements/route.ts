import { NextResponse } from 'next/server';
import { ApiError, apiSend } from '@/lib/api';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(
      await apiSend('PUT', `/admin/tracks/${params.id}/requirements`, await req.json()),
    );
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json(e.body, { status: e.status });
    throw e;
  }
}
