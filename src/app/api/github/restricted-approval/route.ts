import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { decideRestrictedExecution } from '@/lib/governance/approval-decision';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    if ((!body.approvalId && !body.taskId) || !body.decision) {
      return NextResponse.json(
        { ok: false, error: 'approvalId (or taskId) and decision are required.' },
        { status: 400 },
      );
    }
    if (body.decision !== 'APPROVE' && body.decision !== 'REJECT') {
      return NextResponse.json({ ok: false, error: 'decision must be APPROVE or REJECT.' }, { status: 400 });
    }

    const result = await decideRestrictedExecution({
      approvalId: body.approvalId,
      taskId: body.taskId,
      executionId: body.executionId,
      humanActorId: session.userId,
      decision: body.decision,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === 'Human actor not found.'
        ? 403
        : message.includes('not found')
          ? 404
          : message.includes('does not belong') ||
              message.includes('not for restricted') ||
              message.includes('conflicting decision')
            ? 409
            : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
