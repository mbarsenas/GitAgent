import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireCurrentUser } from '@/lib/auth/current-user';

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  let userId: string;
  try {
    userId = (await requireCurrentUser()).userId;
  } catch {
    return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const stale = await prisma.execution.findMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: cutoff },
      task: { repository: { userId } },
    },
    select: { id: true, taskId: true },
  });

  const cleaned: string[] = [];
  for (const execution of stale) {
    const recovered = await prisma.$transaction(async (tx) => {
      const updated = await tx.execution.updateMany({
        where: {
          id: execution.id,
          status: 'RUNNING',
          startedAt: { lt: cutoff },
          task: { repository: { userId } },
        },
        data: { status: 'FAILED', finishedAt: new Date() },
      });
      if (updated.count === 0) return false;
      await tx.task.updateMany({
        where: { id: execution.taskId, status: 'RUNNING' },
        data: { status: 'FAILED' },
      });
      const workspace = await tx.executionWorkspace.findUnique({ where: { executionId: execution.id } });
      if (workspace?.status === 'ACTIVE') {
        await tx.executionWorkspace.update({
          where: { id: workspace.id },
          data: { status: 'SEALED', writable: false, sealedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            taskId: execution.taskId,
            executionId: execution.id,
            eventType: 'workspace.sealed',
            actorType: 'system',
            actorId: 'gitagent-maintenance',
            payload: { workspaceId: workspace.id, workspaceKey: workspace.workspaceKey, reasonCode: 'execution.stale_running_recovered' },
          },
        });
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
      return true;
    });
    if (recovered) cleaned.push(execution.id);
  }

  return NextResponse.json({ ok: true, cutoff: cutoff.toISOString(), cleanedCount: cleaned.length, cleaned });
}
