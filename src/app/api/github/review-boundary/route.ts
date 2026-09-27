import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { NextRequest, NextResponse } from 'next/server';
import { attemptPullRequestApproval } from '@/lib/github/review-boundary';

export async function POST(request: NextRequest) {
  try {
    const session = await requireCurrentUser();
    const body = (await request.json()) as {
      executionId?: string;
      pullRequestNumber?: number;
      actorAgentId?: string;
    };

    if (!body.executionId || !body.pullRequestNumber || !body.actorAgentId) {
      return NextResponse.json(
        { ok: false, error: 'executionId, pullRequestNumber and actorAgentId are required' },
        { status: 400 },
      );
    }

    await requireOwnedExecution(body.executionId, session.userId);
    const result = await attemptPullRequestApproval(
      body.executionId,
      body.pullRequestNumber,
      body.actorAgentId,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Review policy evaluation failed' },
      { status: 500 },
    );
  }
}
