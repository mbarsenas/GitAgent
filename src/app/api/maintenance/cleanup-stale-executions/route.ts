import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { sealExecutionWorkspace } from '@/lib/governance/workspace';

const STALE_AFTER_MS = 5 * 60 * 1000;

export async function POST() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const stale = await prisma.execution.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: cutoff },
    },
    include: { task: true, workspace: true },
  });

  const cleaned: string[] = [];
  for (const execution of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.execution.update({
        where: { id: execution.id },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      if (execution.task.status === 'RUNNING') {
        await tx.task.update({ where: { id: execution.taskId }, data: { status: 'FAILED' } });
      }
      await tx.auditEvent.create({
        data: {
          taskId: execution.taskId,
          executionId: execution.id,
          eventType: 'execution.stale.cleaned',
          actorType: 'system',
          actorId: 'gitagent-maintenance',
          payload: {
            reasonCode: 'execution.stale_running_recovered',
            cutoff: cutoff.toISOString(),
            previousStatus: 'RUNNING',
          },
        },
      });
    });

    if (execution.workspace?.status === 'ACTIVE') {
      await sealExecutionWorkspace(execution.id, 'stale_execution_cleanup');
    }
    cleaned.push(execution.id);
  }

  return NextResponse.json({ ok: true, cutoff: cutoff.toISOString(), cleanedCount: cleaned.length, cleaned });
}
