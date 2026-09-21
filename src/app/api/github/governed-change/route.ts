import { NextRequest, NextResponse } from 'next/server';
import { createGovernedChange } from '@/lib/github/governed-change';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { publicError } from '@/lib/http/public-error';

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentUser();
    const body = (await request.json()) as {
      executionId?: string;
      branch?: string;
      proposedChanges?: Array<{ path: string; content: string; message: string }>;
    };

    if (!body.executionId || !body.branch) {
      return NextResponse.json({ ok: false, error: 'executionId and branch are required' }, { status: 400 });
    }

    await requireOwnedExecution(body.executionId, session.userId);
    const result = await createGovernedChange(body.executionId, body.branch, body.proposedChanges ?? []);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: publicError(error, 'Governed change failed.') },
      { status: error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
