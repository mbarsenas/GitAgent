import { prisma } from '@/lib/db/prisma';

export type HumanDecision = 'APPROVE' | 'REJECT';

export async function decideRestrictedExecution(input: {
  approvalId?: string;
  taskId?: string;
  executionId?: string;
  humanActorId: string;
  decision: HumanDecision;
  reason?: string;
}) {
  const human = await prisma.user.findUnique({ where: { id: input.humanActorId } });
  if (!human) throw new Error('Human actor not found.');

  const approval = input.approvalId
    ? await prisma.approval.findUnique({ where: { id: input.approvalId }, include: { task: true } })
    : await prisma.approval.findFirst({
        where: {
          taskId: input.taskId,
          executionId: input.executionId,
          action: 'restricted.execute',
          status: 'PENDING',
        },
        include: { task: true },
        orderBy: { requestedAt: 'desc' },
      });

  if (!approval) throw new Error('Restricted execution approval not found.');
  if (approval.action !== 'restricted.execute') throw new Error('Approval is not for restricted execution.');
  if (input.taskId && approval.taskId !== input.taskId) throw new Error('approvalId does not belong to taskId.');
  if (input.executionId && approval.executionId !== input.executionId) {
    throw new Error('approvalId does not belong to executionId.');
  }

  const requestedStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

  if (approval.status !== 'PENDING') {
    if (approval.status === requestedStatus) {
      return {
        taskId: approval.taskId,
        approvalId: approval.id,
        executionId: approval.executionId,
        decision: approval.status,
        idempotentReplay: true,
        taskStatus: approval.task.status,
        approvedByUserId: approval.actorId,
      };
    }
    throw new Error(`Approval already decided as ${approval.status}; conflicting decision ${requestedStatus} denied.`);
  }

  const approved = input.decision === 'APPROVE';
  const now = new Date();
  const [updated, task] = await prisma.$transaction([
    prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        actorId: human.id,
        decidedAt: now,
        reason: input.reason ?? null,
      },
    }),
    prisma.task.update({
      where: { id: approval.taskId },
      data: { status: approved ? 'QUEUED' : 'CANCELLED' },
    }),
    prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId: approval.executionId,
        eventType: approved ? 'restricted.execution.approved' : 'restricted.execution.rejected',
        actorType: 'human',
        actorId: human.id,
        payload: {
          approvalId: approval.id,
          executionId: approval.executionId,
          decision: input.decision,
          reason: input.reason ?? null,
          policyVersion: '2026-09-16.1',
        },
      },
    }),
  ]);

  return {
    taskId: approval.taskId,
    approvalId: updated.id,
    executionId: updated.executionId,
    decision: approved ? 'APPROVED' : 'REJECTED',
    idempotentReplay: false,
    taskStatus: task.status,
    approvedByUserId: human.id,
  };
}
