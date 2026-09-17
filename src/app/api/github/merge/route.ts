import { NextResponse } from 'next/server';
import { executeHumanApprovedMerge } from '@/lib/github/merge-boundary';

export async function POST(request: Request) {
  try {
    const { approvalId, humanActorId, reason } = await request.json();
    if (!approvalId || !humanActorId) return NextResponse.json({ ok: false, error: 'approvalId and humanActorId are required.' }, { status: 400 });
    const result = await executeHumanApprovedMerge(approvalId, humanActorId, reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
