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
      include: { task: { include: { repository: true } } },
    });

    const items = approvals.map((approval) => {
      const firstClassBound =
        !!approval.executionId &&
        !!approval.resourceType &&
        !!approval.resourceId;

      return {
        approvalId: approval.id,
        action: approval.action,
        status: approval.status,
        requestedAt: approval.requestedAt,
        executionId: approval.executionId,
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
        actionable: firstClassBound,
        warning: firstClassBound
          ? null
          : 'Legacy/unbound approval. Reconcile provenance before any execution-sensitive action.',
      };
    });

    return NextResponse.json({
      ok: true,
      count: items.length,
      firstClassBound: items.filter((item) => item.provenance.firstClassBound).length,
      unbound: items.filter((item) => !item.provenance.firstClassBound).length,
      approvals: items,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
