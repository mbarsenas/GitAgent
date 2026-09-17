import { NextResponse } from 'next/server';
import {
  executeApprovedMerge,
  executeHumanApprovedMerge,
  MergePolicyError,
  recordHumanMergeDecision,
} from '@/lib/github/merge-boundary';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { approvalId, humanActorId, reason, decision, action } = body;

    if (!approvalId) {
      return NextResponse.json({ ok: false, error: 'approvalId is required.' }, { status: 400 });
    }

    if (action === 'DECIDE') {
      if (!humanActorId || (decision !== 'APPROVE' && decision !== 'REJECT')) {
        return NextResponse.json(
          { ok: false, error: 'humanActorId and decision APPROVE|REJECT are required for DECIDE.' },
          { status: 400 },
        );
      }

      const result = await recordHumanMergeDecision(approvalId, humanActorId, decision, reason);
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

    if (!humanActorId) {
      return NextResponse.json(
        { ok: false, error: 'humanActorId is required when using the compatibility approve-and-execute flow.' },
        { status: 400 },
      );
    }

    const result = await executeHumanApprovedMerge(approvalId, humanActorId, reason);
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
        code: 'merge.internal_error',
        phase: 'merge-control',
        recoveryAware: true,
      },
      { status: 500 },
    );
  }
}
