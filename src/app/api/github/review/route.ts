import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { requireOwnedExecution } from '@/lib/auth/tenant-ownership';
import { publicError } from '@/lib/http/public-error';
import { performPullRequestReview } from '@/lib/github/review-boundary';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const { executionId, pullRequestNumber, reviewerAgentId, action } = await request.json();
    if (!executionId || !pullRequestNumber || !reviewerAgentId || !['REVIEW', 'APPROVE'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'executionId, pullRequestNumber, reviewerAgentId, and action REVIEW|APPROVE are required.' }, { status: 400 });
    }
    await requireOwnedExecution(executionId, session.userId);
    const result = await performPullRequestReview(executionId, Number(pullRequestNumber), reviewerAgentId, action);
    return NextResponse.json({ ok: result.allowed, ...result }, { status: result.allowed ? 200 : 403 });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return NextResponse.json({ ok: false, error: publicError(error, 'Unable to submit the review.') }, { status: unauthenticated ? 401 : 500 });
  }
}
