import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { createGovernedTask } from '@/lib/tasks/create-task';

export async function POST(request: Request) {
  const body = await request.json();

  const repository = await prisma.repository.findUnique({ where: { id: body.repositoryId } });
  const agent = await prisma.agent.findUnique({ where: { id: body.agentId } });
  const initiator = await prisma.user.findUnique({ where: { id: body.initiatorId } });

  if (!repository || !agent || !initiator) {
    return NextResponse.json({ error: 'Repository, agent, or initiator not found.' }, { status: 400 });
  }

  const result = await createGovernedTask({
    repositoryId: repository.id,
    agentId: agent.id,
    initiatorId: initiator.id,
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
}

export async function GET() {
  const [repositories, agents, users] = await Promise.all([
    prisma.repository.findMany({ orderBy: { name: 'asc' } }),
    prisma.agent.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  return NextResponse.json({ repositories, agents, users });
}
