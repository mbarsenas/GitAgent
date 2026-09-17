import { NextResponse } from 'next/server';
import { runRepositoryAgent } from '@/lib/agent/repository-agent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.executionId) {
      return NextResponse.json({ ok: false, error: 'executionId is required.' }, { status: 400 });
    }
    const result = await runRepositoryAgent(body.executionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
