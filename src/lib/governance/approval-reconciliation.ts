import { prisma } from '@/lib/db/prisma';

const POLICY_VERSION = '2026-09-16.1';

function payloadRecord(payload: unknown) {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function parsePrFromAction(action: string) {
  const match = /^pr\.merge:(\d+)$/.exec(action);
  return match ? Number(match[1]) : null;
}

export async function reconcileLegacyApprovalProvenance() {
  const legacy = await prisma.approval.findMany({
    where: {
      OR: [
        { executionId: null },
        { resourceType: null },
        { resourceId: null },
      ],
    },
    include: { task: true },
    orderBy: { requestedAt: 'asc' },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const approval of legacy) {
    if (!approval.action.startsWith('pr.merge:')) {
      results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_NON_MERGE' });
      continue;
    }

    const pullRequestNumber = parsePrFromAction(approval.action);
    if (!pullRequestNumber) {
      results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_INVALID_ACTION' });
      continue;
    }

    const requestEvents = await prisma.auditEvent.findMany({
      where: { taskId: approval.taskId, eventType: 'merge.approval.requested' },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const matchingRequests = requestEvents.filter((event) => {
      const payload = payloadRecord(event.payload);
      return (
        payload.approvalId === approval.id &&
        Number(payload.pullRequestNumber) === pullRequestNumber &&
        typeof payload.executionId === 'string'
      );
    });

    if (matchingRequests.length !== 1) {
      results.push({
        approvalId: approval.id,
        action: approval.action,
        status: matchingRequests.length === 0 ? 'SKIPPED_NO_EXACT_BINDING' : 'SKIPPED_AMBIGUOUS_BINDING',
      });
      continue;
    }

    const requestEvent = matchingRequests[0];
    const requestPayload = payloadRecord(requestEvent.payload);
    const executionId = String(requestPayload.executionId);

    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution || execution.taskId !== approval.taskId) {
      results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_EXECUTION_TASK_MISMATCH' });
      continue;
    }

    const reviewEvents = await prisma.auditEvent.findMany({
      where: { executionId, eventType: 'github.review.approved' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const exactReview = reviewEvents.find((event) => {
      const payload = payloadRecord(event.payload);
      return (
        Number(payload.pullRequestNumber) === pullRequestNumber &&
        payload.reviewGitHubApp === 'gitagent-review' &&
        typeof payload.implementationAgentId === 'string' &&
        typeof payload.reviewerAgentId === 'string' &&
        payload.implementationAgentId !== payload.reviewerAgentId
      );
    });

    if (!exactReview) {
      results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_NO_INDEPENDENT_REVIEW' });
      continue;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.approval.findUnique({ where: { id: approval.id } });
      if (!current) throw new Error(`Approval disappeared during reconciliation: ${approval.id}`);
      if (current.executionId || current.resourceType || current.resourceId) return current;

      const reconciled = await tx.approval.update({
        where: { id: approval.id },
        data: {
          executionId,
          resourceType: 'github.pull_request',
          resourceId: String(pullRequestNumber),
        },
      });

      await tx.auditEvent.create({
        data: {
          taskId: approval.taskId,
          executionId,
          eventType: 'approval.provenance.reconciled',
          actorType: 'system',
          actorId: 'gitagent',
          payload: {
            approvalId: approval.id,
            pullRequestNumber,
            resourceType: 'github.pull_request',
            resourceId: String(pullRequestNumber),
            mergeRequestAuditEventId: requestEvent.id,
            reviewApprovalAuditEventId: exactReview.id,
            policyVersion: POLICY_VERSION,
          },
        },
      });

      return reconciled;
    });

    results.push({
      approvalId: approval.id,
      action: approval.action,
      status: 'RECONCILED',
      executionId: updated.executionId,
      resourceType: updated.resourceType,
      resourceId: updated.resourceId,
    });
  }

  return {
    scanned: legacy.length,
    reconciled: results.filter((result) => result.status === 'RECONCILED').length,
    results,
  };
}
