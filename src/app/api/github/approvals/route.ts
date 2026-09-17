import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const repository = await prisma.repository.findFirst({
      where: { provider: 'github', externalId: '1373462743' },
    });
    if (!repository) throw new Error('Canonical repository missing.');

    const approvals = await prisma.approval.findMany({
      where: { status: 'PENDING', task: { repositoryId: repository.id } },
      orderBy: { requestedAt: 'asc' },
      include: {
        task: {
          include: {
            repository: true,
            executions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      count: approvals.length,
      approvals: approvals.map((approval) => {
        const executionId = approval.executionId ?? approval.task.executions[0]?.id ?? null;
        const firstClassBound =
          !!approval.executionId &&
          !!approval.resourceType &&
          !!approval.resourceId;

        return {
          approvalId: approval.id,
          action: approval.action,
          status: approval.status,
          requestedAt: approval.requestedAt,
          executionId,
          provenance: {
            firstClassBound,
            executionId: approval.executionId,
            resourceType: approval.resourceType,
            resourceId: approval.resourceId,
          },
          task: {
            id: approval.task.id,
            title: approval.task.title,
            status: approval.task.status,
          },
          repository: `${approval.task.repository.owner}/${approval.task.repository.name}`,
          decisionEndpoint:
            approval.action === 'restricted.execute'
              ? '/api/github/restricted-approval'
              : approval.action.startsWith('pr.merge:')
                ? '/api/github/merge'
                : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
