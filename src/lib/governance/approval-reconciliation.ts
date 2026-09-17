import { prisma } from '@/lib/db/prisma';

const POLICY_VERSION = '2026-09-16.1';

function payloadRecord(payload: unknown) {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

function parsePrFromAction(action: string) {
  const match = /^pr\.merge:(\d+)$/.exec(action);
  return match ? Number(match[1]) : null;
}

async function reconcileRestrictedApproval(
  approval: { id: string; taskId: string; action: string; executionId: string | null; resourceType: string | null; resourceId: string | null },
  results: Array<Record<string, unknown>>,
) {
  const requestEvents = await prisma.auditEvent.findMany({
    where: { taskId: approval.taskId, eventType: 'restricted.execution.approval_requested' },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const matchingRequests = requestEvents.filter((event) => {
    const payload = payloadRecord(event.payload);
    return payload.approvalId === approval.id && typeof event.executionId === 'string';
  });

  if (matchingRequests.length !== 1) {
    results.push({
      approvalId: approval.id,
      action: approval.action,
      status: matchingRequests.length === 0 ? 'SKIPPED_NO_EXACT_BINDING' : 'SKIPPED_AMBIGUOUS_BINDING',
    });
    return;
  }

  const requestEvent = matchingRequests[0];
  const executionId = requestEvent.executionId!;
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution || execution.taskId !== approval.taskId) {
    results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_EXECUTION_TASK_MISMATCH' });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.approval.findUnique({ where: { id: approval.id } });
    if (!current) throw new Error(`Approval disappeared during reconciliation: ${approval.id}`);
    if (current.executionId || current.resourceType || current.resourceId) return current;

    const reconciled = await tx.approval.update({
      where: { id: approval.id },
      data: {
        executionId,
        resourceType: 'execution',
        resourceId: executionId,
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
          action: approval.action,
          resourceType: 'execution',
          resourceId: executionId,
          restrictedRequestAuditEventId: requestEvent.id,
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

async function reconcileMergeApproval(
  approval: { id: string; taskId: string; action: string; executionId: string | null; resourceType: string | null; resourceId: string | null },
  results: Array<Record<string, unknown>>,
) {
  const pullRequestNumber = parsePrFromAction(approval.action);
  if (!pullRequestNumber) {
    results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_INVALID_ACTION' });
    return;
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
    return;
  }

  const requestEvent = matchingRequests[0];
  const requestPayload = payloadRecord(requestEvent.payload);
  const executionId = String(requestPayload.executionId);

  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution || execution.taskId !== approval.taskId) {
    results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_EXECUTION_TASK_MISMATCH' });
    return;
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
    return;
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
          action: approval.action,
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

export async function reconcileLegacyApprovalProvenance() {
  const legacy = await prisma.approval.findMany({
    where: {
      OR: [{ executionId: null }, { resourceType: null }, { resourceId: null }],
    },
    orderBy: { requestedAt: 'asc' },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const approval of legacy) {
    if (approval.action === 'restricted.execute') {
      await reconcileRestrictedApproval(approval, results);
      continue;
    }

    if (approval.action.startsWith('pr.merge:')) {
      await reconcileMergeApproval(approval, results);
      continue;
    }

    results.push({ approvalId: approval.id, action: approval.action, status: 'SKIPPED_UNSUPPORTED_ACTION' });
  }

  return {
    scanned: legacy.length,
    reconciled: results.filter((result) => result.status === 'RECONCILED').length,
    results,
  };
}
