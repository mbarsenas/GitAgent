import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { verifyExecutionBoundaries } from '@/lib/github/security-suite';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const { executionId, pullRequestNumber } = await request.json();
    if (typeof executionId !== 'string' || !Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
      return NextResponse.json({ ok: false, error: 'A valid execution and pull request are required.' }, { status: 400 });
    }
    await requireOwnedExecution(executionId, session.userId);
    const result = await verifyExecutionBoundaries(executionId, pullRequestNumber);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'EXECUTION_NOT_FOUND_OR_FORBIDDEN' ? 404 : 409;
    return NextResponse.json({ ok: false, error: 'Unable to verify this execution. A completed, commit-bound independent review is required.' }, { status });
  }
}
