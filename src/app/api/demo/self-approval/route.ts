import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { performGovernedTaskAction } from '@/lib/governance/task-actions';

export async function POST() {
  const task = await prisma.task.findFirst({
    where: {
      title: 'Demonstrate self-approval denial',
      agent: { slug: 'demo-implementation-agent' },
      repository: { externalId: 'mbarsenas/GitAgent' },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      agent: true,
      repository: true,
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!task?.agent || task.executions.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        denied: false,
        reasonCode: 'demo.seed_data_missing',
        message: 'Run npm run db:seed before running the adversarial test.',
      },
      { status: 409 },
    );
  }

  const execution = task.executions[0];

  const result = await performGovernedTaskAction({
    role: 'implementation-agent',
    capability: 'review.approve',
    actorId: task.agent.id,
    targetOwnerAgentId: task.agent.id,
    taskId: task.id,
    repositoryId: task.repository.id,
    executionId: execution.id,
    policyVersion: '2026-09-16.1',
  });

  return NextResponse.json(
    {
      ...result,
      taskId: task.id,
      repositoryId: task.repository.id,
      agentId: task.agent.id,
      executionId: execution.id,
    },
    { status: result.ok ? 200 : 403 },
  );
}
