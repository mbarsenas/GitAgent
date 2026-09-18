import { NextResponse } from 'next/server';
import { getAgentTrustState, recordSubstantiveViolation, restrictAgent } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });
    if (body.action === 'restrict') return NextResponse.json({ ok: true, ...(await restrictAgent(body.agentId, body.taskId ?? null, body.executionId ?? null, body.reasonCode ?? 'policy.manual_restriction')) });
    if (body.action === 'quarantine') return NextResponse.json({ ok: true, ...(await recordSubstantiveViolation(body.agentId, body.taskId ?? null, body.executionId ?? null, body.reasonCode ?? 'policy.substantive_violation')) });
    return NextResponse.json({ ok: true, agentId: body.agentId, trustState: await getAgentTrustState(body.agentId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
