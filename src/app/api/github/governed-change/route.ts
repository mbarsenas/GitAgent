import { NextRequest, NextResponse } from 'next/server';
import { createGovernedChange } from '@/lib/github/governed-change';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      executionId?: string;
      branch?: string;
      proposedChanges?: Array<{ path: string; content: string; message: string }>;
    };

    if (!body.executionId || !body.branch) {
      return NextResponse.json({ ok: false, error: 'executionId and branch are required' }, { status: 400 });
    }

    const result = await createGovernedChange(body.executionId, body.branch, body.proposedChanges ?? []);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Governed change failed' },
      { status: 500 },
    );
  }
}
