import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';
import { getAgentTrustState, recordSubstantiveViolation, restrictAgent } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    if (typeof body.agentId !== 'string' || !body.agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });
    const owned = await prisma.agent.findFirst({ where: { id: body.agentId, repository: { userId: session.userId } } });
    if (!owned) return NextResponse.json({ ok: false, error: 'Agent not found.' }, { status: 404 });
    if (!body.agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });
    if (body.action === 'restrict') return NextResponse.json({ ok: true, ...(await restrictAgent(body.agentId, null, null, body.reasonCode ?? 'policy.manual_restriction')) });
    if (body.action === 'quarantine') return NextResponse.json({ ok: true, ...(await recordSubstantiveViolation(body.agentId, null, null, body.reasonCode ?? 'policy.substantive_violation')) });
    return NextResponse.json({ ok: true, agentId: body.agentId, trustState: await getAgentTrustState(body.agentId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
