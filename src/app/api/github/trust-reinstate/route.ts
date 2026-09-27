import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { NextResponse } from 'next/server';
import { reinstateQuarantinedAgent } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    if (typeof body.agentId !== 'string' || !body.agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });
    const owned = await prisma.agent.findFirst({ where: { id: body.agentId, repository: { userId: session.userId } } });
    if (!owned) return NextResponse.json({ ok: false, error: 'Agent not found.' }, { status: 404 });
    if (!body.agentId || !body.reason) return NextResponse.json({ ok: false, error: 'agentId, humanActorId, and reason are required.' }, { status: 400 });
    const result = await reinstateQuarantinedAgent(body.agentId, session.userId, body.reason);
    return NextResponse.json({ ok: result.allowed, ...result }, { status: result.allowed ? 200 : 403 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
