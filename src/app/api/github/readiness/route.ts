import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';
import { isExactIndependentApproval, outcomeEventTypes } from '@/lib/github/readiness-evidence';

const POLICY_VERSION = '2026-09-16.1';

function payloadRecord(payload: unknown) {
  return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
}

export async function GET() {
  try {
    const repositories = await prisma.repository.findMany({
      where: { provider: 'github', owner: 'mbarsenas', name: 'GitAgent' },
    });
    const canonical = repositories.find((repository) => repository.externalId === '1373462743');
    if (!canonical) throw new Error('Canonical repository missing.');
    const latestExecution = await prisma.execution.findFirst({
      where: { task: { repositoryId: canonical.id } },
      orderBy: { createdAt: 'desc' },
      include: { agent: true },
    });
    const latestReview = latestExecution
      ? await prisma.auditEvent.findFirst({
          where: { executionId: latestExecution.id, eventType: 'github.review.approved' },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const implementation = latestExecution?.agent ?? await prisma.agent.findUnique({ where: { slug: 'demo-implementation-agent' } });
    const review = await prisma.agent.findUnique({
      where: latestReview?.actorId ? { id: latestReview.actorId } : { slug: 'demo-review-agent' },
    });
    const repositoryScope = { task: { repositoryId: canonical.id } };
    if (!canonical || !implementation || !review) {
      throw new Error('Canonical repository or control-plane agents missing.');
    }

    const [
      trust,
      securityRun,
      mergeDenied,
      selfDenied,
      reviewApproved,
      pendingApprovals,
      mergeRequests,
      restrictedRequests,
      completed,
      failed,
      mergedEvents,
      sealedEvents,
      reconciledEvents,
    ] = await Promise.all([
      getAgentTrustState(implementation.id),
      prisma.auditEvent.findFirst({ where: { ...repositoryScope, eventType: 'security.suite.completed' }, orderBy: { createdAt: 'desc' } }),
      prisma.auditEvent.count({ where: { ...repositoryScope, eventType: 'policy.merge.denied' } }),
      prisma.auditEvent.count({ where: { ...repositoryScope, eventType: 'policy.review.denied' } }),
      prisma.auditEvent.findMany({
        where: { ...repositoryScope, eventType: 'github.review.approved' },
        include: { execution: { select: { id: true, agentId: true, taskId: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.approval.findMany({
        where: { status: 'PENDING', task: { repositoryId: canonical.id } },
        orderBy: { requestedAt: 'asc' },
        take: 100,
      }),
      prisma.auditEvent.findMany({
        where: { eventType: 'merge.approval.requested', task: { repositoryId: canonical.id } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.auditEvent.findMany({
        where: { eventType: 'restricted.execution.approval_requested', task: { repositoryId: canonical.id } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.execution.count({ where: { ...repositoryScope, auditEvents: { some: { eventType: { in: outcomeEventTypes.completed } } } } }),
      prisma.execution.count({ where: { ...repositoryScope, auditEvents: { some: { eventType: { in: outcomeEventTypes.failed } } } } }),
      prisma.auditEvent.findMany({ where: { ...repositoryScope, eventType: 'github.pr.merged' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.auditEvent.findMany({ where: { ...repositoryScope, eventType: 'workspace.sealed' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.auditEvent.findMany({
        where: { eventType: 'approval.provenance.reconciled', task: { repositoryId: canonical.id } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const securityPayload = payloadRecord(securityRun?.payload);
    const exactApprovals = reviewApproved.filter(isExactIndependentApproval);

    const approvalHasExactBinding = (approval: (typeof pendingApprovals)[number]) => {
      if (!approval.executionId || !approval.resourceType || !approval.resourceId) return false;

      if (approval.action === 'restricted.execute') {
        return restrictedRequests.some((event) => {
          const payload = payloadRecord(event.payload);
          return (
            event.taskId === approval.taskId &&
            event.executionId === approval.executionId &&
            payload.approvalId === approval.id &&
            payload.executionId === approval.executionId &&
            payload.resourceType === approval.resourceType &&
            payload.resourceId === approval.resourceId
          );
        });
      }

      if (approval.action.startsWith('pr.merge:')) {
        return mergeRequests.some((event) => {
          const payload = payloadRecord(event.payload);
          return (
            event.taskId === approval.taskId &&
            event.executionId === approval.executionId &&
            payload.approvalId === approval.id &&
            payload.executionId === approval.executionId &&
            payload.resourceType === approval.resourceType &&
            payload.resourceId === approval.resourceId &&
            String(payload.pullRequestNumber) === approval.resourceId
          );
        });
      }

      return false;
    };

    const exactlyBoundPending = pendingApprovals.filter(approvalHasExactBinding);
    const legacyUnboundPending = pendingApprovals.filter((approval) => !approvalHasExactBinding(approval));

    const mergedWithSealedWorkspace = mergedEvents.filter((merged) =>
      sealedEvents.some((sealed) => sealed.executionId && sealed.executionId === merged.executionId),
    );

    const reconciliationValid = reconciledEvents.every((event) => {
      const payload = payloadRecord(event.payload);
      if (payload.resourceType === 'execution') {
        return (
          typeof payload.approvalId === 'string' &&
          typeof event.executionId === 'string' &&
          payload.resourceId === event.executionId &&
          typeof payload.restrictedRequestAuditEventId === 'string'
        );
      }

      return (
        typeof payload.approvalId === 'string' &&
        typeof event.executionId === 'string' &&
        payload.resourceType === 'github.pull_request' &&
        typeof payload.resourceId === 'string' &&
        typeof payload.pullRequestNumber === 'number' &&
        String(payload.pullRequestNumber) === payload.resourceId &&
        typeof payload.mergeRequestAuditEventId === 'string' &&
        typeof payload.reviewApprovalAuditEventId === 'string'
      );
    });

    const checks = [
      { name: 'canonical_repository_identity', passed: repositories.length === 1 && canonical.externalId === '1373462743' },
      { name: 'implementation_review_identity_separation', passed: implementation.id !== review.id },
      { name: 'security_suite_latest_passed', passed: securityPayload.passed === true && Number(securityPayload.totalChecks) >= 9 },
      { name: 'self_approval_boundary_observed', passed: selfDenied > 0 },
      { name: 'agent_merge_boundary_observed', passed: mergeDenied >= 2 },
      { name: 'exact_independent_approval_observed', passed: exactApprovals.length > 0 },
      { name: 'actionable_pending_approvals_exactly_bound', passed: exactlyBoundPending.every(approvalHasExactBinding) },
      { name: 'legacy_reconciliation_evidence_valid', passed: reconciliationValid },
      { name: 'merged_workspaces_sealed', passed: mergedEvents.length === 0 || mergedWithSealedWorkspace.length === mergedEvents.length },
      { name: 'execution_outcomes_audited', passed: completed + failed > 0 },
      { name: 'trust_state_available', passed: ['TRUSTED', 'RESTRICTED', 'QUARANTINED'].includes(trust) },
    ];

    const failedChecks = checks.filter((check) => !check.passed);

    return NextResponse.json({
      ok: true,
      ready: failedChecks.length === 0,
      policyVersion: POLICY_VERSION,
      summary: {
        total: checks.length,
        passed: checks.length - failedChecks.length,
        failed: failedChecks.length,
      },
      repository: {
        id: canonical.id,
        externalId: canonical.externalId,
        duplicates: repositories.length - 1,
      },
      identities: {
        implementationAgentId: implementation.id,
        reviewAgentId: review.id,
        separate: implementation.id !== review.id,
      },
      trustState: trust,
      pendingApprovals: {
        total: pendingApprovals.length,
        exactlyBound: exactlyBoundPending.length,
        historicalUnbound: legacyUnboundPending.map((approval) => ({
          id: approval.id,
          action: approval.action,
          taskId: approval.taskId,
          executionId: approval.executionId,
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          actionable: false,
          reason: 'Historical approval predates first-class provenance and has no exact evidence for safe reconciliation.',
        })),
      },
      evidence: {
        exactIndependentApprovals: exactApprovals.length,
        mergeApprovalRequests: mergeRequests.length,
        restrictedApprovalRequests: restrictedRequests.length,
        reconciledApprovalEvents: reconciledEvents.length,
        completedExecutions: completed,
        failedExecutions: failed,
        mergedEvents: mergedEvents.length,
        mergedWithSealedWorkspace: mergedWithSealedWorkspace.length,
      },
      latestSecuritySuite: securityRun
        ? { id: securityRun.id, createdAt: securityRun.createdAt, payload: securityRun.payload }
        : null,
      checks,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, ready: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
