import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { runRepositoryAgent } from '@/lib/agent/repository-agent';
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const { taskId } = await request.json();
    if (typeof taskId !== 'string' || !taskId) return NextResponse.json({ ok: false, error: 'taskId is required.' }, { status: 400 });
    const execution = await prisma.execution.findFirst({ where: { taskId, status: 'CREATED', task: { repository: { userId: session.userId } }, approvals: { some: { action: 'restricted.execute', status: 'APPROVED' } } }, orderBy: { createdAt: 'desc' } });
    if (!execution) return NextResponse.json({ ok: false, error: 'No approved, unstarted execution exists for this task.' }, { status: 409 });
    return NextResponse.json({ ok: true, ...await runRepositoryAgent(execution.id) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Unable to resume this execution.' }, { status: 409 });
  }
}
