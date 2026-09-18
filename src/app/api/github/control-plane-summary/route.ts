import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';

export async function GET() {
  try {
    const repo = await prisma.repository.findFirst({
      where: { provider: 'github', externalId: '1373462743' },
    });
    if (!repo) throw new Error('Canonical repository missing.');

    const agents = await prisma.agent.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { repositoryId: repo.id },
          { repositoryId: null, grants: { some: { capability: 'review.approve' } } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const trust = await Promise.all(
      agents.map(async (agent) => ({
        id: agent.id,
        name: agent.name,
        slug: agent.slug,
        repositoryScoped: agent.repositoryId === repo.id,
        globalReviewer: agent.repositoryId === null,
        trustState: await getAgentTrustState(agent.id),
      })),
    );

    const [tasks, executions, pending, events] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: { repositoryId: repo.id },
        _count: { _all: true },
      }),
      prisma.execution.groupBy({
        by: ['status'],
        where: { task: { repositoryId: repo.id } },
        _count: { _all: true },
      }),
      prisma.approval.findMany({
        where: { status: 'PENDING', task: { repositoryId: repo.id } },
        orderBy: { requestedAt: 'asc' },
        take: 25,
        include: { task: { select: { title: true } } },
      }),
      prisma.auditEvent.findMany({
        where: { task: { repositoryId: repo.id } },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      policyVersion: '2026-09-16.1',
      repository: { id: repo.id, externalId: repo.externalId, fullName: `${repo.owner}/${repo.name}` },
      agents: trust,
      tasks: Object.fromEntries(tasks.map((item) => [item.status, item._count._all])),
      executions: Object.fromEntries(executions.map((item) => [item.status, item._count._all])),
      pendingApprovals: pending.map((approval) => ({
        id: approval.id,
        taskId: approval.taskId,
        executionId: approval.executionId,
        taskTitle: approval.task.title,
        action: approval.action,
        resourceType: approval.resourceType,
        resourceId: approval.resourceId,
        requestedAt: approval.requestedAt,
      })),
      recentGovernanceEvents: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        taskId: event.taskId,
        executionId: event.executionId,
        createdAt: event.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
