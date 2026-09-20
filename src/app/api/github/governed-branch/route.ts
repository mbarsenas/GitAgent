import { NextRequest, NextResponse } from 'next/server';
import { createGovernedBranch } from '@/lib/github/governed-branch';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { executionId?: string };
    if (!body.executionId) {
      return NextResponse.json({ ok: false, error: 'executionId is required' }, { status: 400 });
    }
    const result = await createGovernedBranch(body.executionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Governed branch creation failed' },
      { status: 500 },
    );
  }
}
