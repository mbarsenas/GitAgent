import { NextResponse } from 'next/server';
import {
  executeApprovedMerge,
  executeHumanApprovedMerge,
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
      return NextResponse.json({ ok: true, phase: 'decision', ...result });
    }

    if (action === 'EXECUTE') {
      const result = await executeApprovedMerge(approvalId);
      return NextResponse.json({ ok: true, phase: 'execution', ...result });
    }

    if (!humanActorId) {
      return NextResponse.json(
        { ok: false, error: 'humanActorId is required when using the compatibility approve-and-execute flow.' },
        { status: 400 },
      );
    }

    const result = await executeHumanApprovedMerge(approvalId, humanActorId, reason);
    return NextResponse.json({ ok: true, phase: 'decision+execution', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not found')
      ? 404
      : message.includes('already decided') ||
          message.includes('must be APPROVED') ||
          message.includes('binding') ||
          message.includes('provenance')
        ? 409
        : message.includes('Human actor')
          ? 403
          : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
