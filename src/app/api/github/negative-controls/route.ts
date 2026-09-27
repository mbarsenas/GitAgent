import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { NextResponse } from 'next/server';
import { evaluateProtectedBranchWrite, evaluateWorkspaceWrite } from '@/lib/github/negative-controls';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    if (!body.executionId) return NextResponse.json({ ok: false, error: 'executionId is required.' }, { status: 400 });
    await requireOwnedExecution(body.executionId, session.userId);
    const protectedBranch = await evaluateProtectedBranchWrite(body.executionId, body.targetBranch ?? 'main');
    const crossWorkspace = await evaluateWorkspaceWrite(body.executionId, body.requestedWorkspaceExecutionId ?? 'foreign-workspace');
    return NextResponse.json({ ok: true, protectedBranch, crossWorkspace });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
