import { NextRequest, NextResponse } from 'next/server';
import { createGovernedBranch } from '@/lib/github/governed-branch';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { publicError } from '@/lib/http/public-error';

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentUser();
    const body = (await request.json()) as { executionId?: string };
    if (!body.executionId) {
      return NextResponse.json({ ok: false, error: 'executionId is required' }, { status: 400 });
    }
    await requireOwnedExecution(body.executionId, session.userId);
    const result = await createGovernedBranch(body.executionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: publicError(error, 'Governed branch creation failed.') },
      { status: error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
