import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { createGovernedTask } from '@/lib/tasks/create-task';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();

    const repository = await prisma.repository.findFirst({
      where: { id: body.repositoryId, userId: session.userId, provider: 'github' },
    });
    const agent = await prisma.agent.findUnique({ where: { id: body.agentId } });

    if (!repository || !agent) {
      return NextResponse.json({ error: 'Repository or agent not found for this account.' }, { status: 400 });
    }

    const owner = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, githubInstallationId: true },
    });
    if (!owner?.githubInstallationId) {
      return NextResponse.json({ error: 'Repository owner does not have a GitHub App installation connected.' }, { status: 409 });
    }

    const result = await createGovernedTask({
      repositoryId: repository.id,
      agentId: agent.id,
      initiatorId: session.userId,
      title: body.title,
      goal: body.goal,
      maxCostUsd: Number(body.maxCostUsd ?? 1),
      maxTokens: Number(body.maxTokens ?? 20000),
      requiresHumanApproval: body.requiresHumanApproval ?? true,
      capabilities: body.capabilities ?? ['branch.create', 'code.write', 'test.execute', 'pr.create'],
      policyVersion: body.policyVersion ?? '2026-09-16.1',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    return NextResponse.json({
      taskId: result.task.id,
      executionId: result.execution.id,
      status: result.task.status,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('POST /api/tasks failed', error);
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? 'Sign in is required.' : message, code: status === 401 ? 'unauthenticated' : 'task_creation_failed' },
      { status },
    );
  }
}

export async function GET() {
  try {
    const session = await requireCurrentUser();
    const [repositories, agents, user] = await Promise.all([
      prisma.repository.findMany({
        where: { provider: 'github', userId: session.userId },
        orderBy: [{ owner: 'asc' }, { name: 'asc' }],
      }),
      prisma.agent.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
      prisma.user.findUnique({ where: { id: session.userId } }),
    ]);

    return NextResponse.json({ repositories, agents, users: user ? [user] : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET /api/tasks failed', error);
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? 'Sign in is required.' : message, code: status === 401 ? 'unauthenticated' : 'task_bootstrap_failed' },
      { status },
    );
  }
}
