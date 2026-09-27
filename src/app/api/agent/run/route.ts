import { NextResponse } from 'next/server';
import { runRepositoryAgent } from '@/lib/agent/repository-agent';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { publicError } from '@/lib/http/public-error';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    if (!body.executionId) {
      return NextResponse.json({ ok: false, error: 'executionId is required.' }, { status: 400 });
    }
    await requireOwnedExecution(body.executionId, session.userId);
    const result = await runRepositoryAgent(body.executionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === 'Execution has already started or finished.') return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    return NextResponse.json(
      { ok: false, error: publicError(error, 'Unable to start the governed execution.') },
      { status: error instanceof Error && error.message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
