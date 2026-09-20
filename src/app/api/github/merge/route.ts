import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import {
  executeApprovedMerge,
  executeHumanApprovedMerge,
  MergePolicyError,
  recordHumanMergeDecision,
} from '@/lib/github/merge-boundary';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    const { approvalId, reason, decision, action } = body;

    if (!approvalId) {
      return NextResponse.json({ ok: false, error: 'approvalId is required.' }, { status: 400 });
    }

    if (action === 'DECIDE') {
      if (decision !== 'APPROVE' && decision !== 'REJECT') {
        return NextResponse.json(
          { ok: false, error: 'decision APPROVE|REJECT is required for DECIDE.' },
          { status: 400 },
        );
      }

      const result = await recordHumanMergeDecision(approvalId, session.userId, decision, reason);
      return NextResponse.json({
        ok: true,
        phase: 'decision',
        nextAction: decision === 'APPROVE' ? 'EXECUTE' : null,
        ...result,
      });
    }

    if (action === 'EXECUTE') {
      const result = await executeApprovedMerge(approvalId);
      return NextResponse.json({
        ok: true,
        phase: 'execution',
        recoveryAware: true,
        ...result,
      });
    }

    const result = await executeHumanApprovedMerge(approvalId, session.userId, reason);
    return NextResponse.json({
      ok: true,
      phase: 'decision+execution',
      compatibilityFlow: true,
      recoveryAware: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof MergePolicyError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          phase: 'merge-control',
          recoveryAware: true,
        },
        { status: error.httpStatus },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: message === 'UNAUTHENTICATED' ? 'auth.unauthenticated' : 'merge.internal_error',
        phase: 'merge-control',
        recoveryAware: true,
      },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 },
    );
  }
}
