import { getAgentTrustState } from '@/lib/github/trust-lifecycle';
import { codingCapabilities, validateTaskInput } from '@/lib/tasks/task-input';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { createGovernedTask } from '@/lib/tasks/create-task';
import { assertRepositoryEntitled } from '@/lib/billing/entitlements';

export async function POST(request: Request) {
  try {
    const session = await requireCurrentUser();
    const body = await request.json();
    const validated = validateTaskInput(body);

    const repository = await prisma.repository.findFirst({
      where: { id: body.repositoryId, userId: session.userId, provider: 'github' },
    });
    const agent = await prisma.agent.findUnique({ where: { id: body.agentId }, include: { grants: { where: { capability: 'review.approve', effect: 'ALLOW' } } } });

    if (!repository || !agent || agent.status !== 'ACTIVE' || agent.repositoryId !== repository.id || agent.grants.length > 0) {
      return NextResponse.json({ error: 'Repository or agent not found for this account.' }, { status: 400 });
    }
    await assertRepositoryEntitled(session.userId, repository.id);

    const owner = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, githubInstallationId: true },
    });
    if (!owner?.githubInstallationId) {
      return NextResponse.json({ error: 'Repository owner does not have a GitHub App installation connected.' }, { status: 409 });
    }

    const trust = await getAgentTrustState(agent.id);
    if (trust === 'QUARANTINED') return NextResponse.json({ error: 'This agent is quarantined. Review its trust status before starting work.' }, { status: 409 });
    const result = await createGovernedTask({
      restricted: trust === 'RESTRICTED',
      repositoryId: repository.id,
      agentId: agent.id,
      initiatorId: session.userId,
      ...validated,
      requiresHumanApproval: true,
      capabilities: body.capabilities ?? codingCapabilities,
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
    const planLimit = message.startsWith('PLAN_REPOSITORY_LIMIT:');
    const status = message === 'UNAUTHENTICATED' ? 401 : message.startsWith('INVALID_TASK_') ? 400 : planLimit ? 403 : 500;
    const planParts = planLimit ? message.split(':') : [];
    return NextResponse.json(
      { error: status === 401 ? 'Sign in is required.' : status === 400 ? 'Check the task details, budget, and requested permissions.' : planLimit ? `Your ${planParts[1]} plan includes up to ${planParts[2]} connected repositories. Upgrade your plan or use a repository within the plan limit.` : 'Unable to process this task request.', code: status === 401 ? 'unauthenticated' : planLimit ? 'plan_repository_limit' : 'task_creation_failed' },
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
      prisma.agent.findMany({ where: { status: 'ACTIVE', repository: { userId: session.userId }, grants: { none: { capability: 'review.approve', effect: 'ALLOW' } } }, orderBy: { name: 'asc' } }),
      prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true } }),
    ]);

    return NextResponse.json({ repositories, agents, users: user ? [user] : [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('GET /api/tasks failed', error);
    const status = message === 'UNAUTHENTICATED' ? 401 : message.startsWith('INVALID_TASK_') ? 400 : 500;
    return NextResponse.json(
      { error: status === 401 ? 'Sign in is required.' : status === 400 ? 'Check the task details, budget, and requested permissions.' : 'Unable to process this task request.', code: status === 401 ? 'unauthenticated' : 'task_bootstrap_failed' },
      { status },
    );
  }
}
