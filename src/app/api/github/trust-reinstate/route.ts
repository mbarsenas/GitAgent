import { NextResponse } from 'next/server';
import { reinstateQuarantinedAgent } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.agentId || !body.humanActorId || !body.reason) return NextResponse.json({ ok: false, error: 'agentId, humanActorId, and reason are required.' }, { status: 400 });
    const result = await reinstateQuarantinedAgent(body.agentId, body.humanActorId, body.reason);
    return NextResponse.json({ ok: result.allowed, ...result }, { status: result.allowed ? 200 : 403 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
