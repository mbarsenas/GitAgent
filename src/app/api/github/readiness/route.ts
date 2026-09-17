import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';

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
    const implementation = await prisma.agent.findUnique({ where: { slug: 'demo-implementation-agent' } });
    const review = await prisma.agent.findUnique({ where: { slug: 'demo-review-agent' } });
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
      completed,
      failed,
      mergedEvents,
      sealedEvents,
    ] = await Promise.all([
      getAgentTrustState(implementation.id),
      prisma.auditEvent.findFirst({ where: { eventType: 'security.suite.completed' }, orderBy: { createdAt: 'desc' } }),
      prisma.auditEvent.count({ where: { eventType: 'policy.merge.denied' } }),
      prisma.auditEvent.count({ where: { eventType: 'policy.review.denied' } }),
      prisma.auditEvent.findMany({
        where: { eventType: 'github.review.approved', actorId: review.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.approval.findMany({
        where: { status: 'PENDING', task: { repositoryId: canonical.id } },
        orderBy: { requestedAt: 'asc' },
        take: 100,
      }),
      prisma.auditEvent.findMany({ where: { eventType: 'merge.approval.requested' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.auditEvent.count({ where: { eventType: 'execution.completed', actorId: implementation.id } }),
      prisma.auditEvent.count({ where: { eventType: 'execution.failed', actorId: implementation.id } }),
      prisma.auditEvent.findMany({ where: { eventType: 'github.pr.merged' }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.auditEvent.findMany({ where: { eventType: 'workspace.sealed' }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);

    const securityPayload = payloadRecord(securityRun?.payload);
    const exactApprovals = reviewApproved.filter((event) => {
      const payload = payloadRecord(event.payload);
      return (
        payload.reviewGitHubApp === 'gitagent-review' &&
        typeof payload.pullRequestNumber === 'number' &&
        payload.reviewerAgentId === review.id &&
        payload.implementationAgentId === implementation.id
      );
    });

    const boundMergeRequests = mergeRequests.filter((event) => {
      const payload = payloadRecord(event.payload);
      return (
        typeof payload.executionId === 'string' &&
        typeof payload.pullRequestNumber === 'number' &&
        typeof payload.approvalId === 'string' &&
        payload.resourceType === 'github.pull_request' &&
        typeof payload.resourceId === 'string'
      );
    });

    const boundPending = pendingApprovals.filter(
      (approval) => !!approval.executionId && !!approval.resourceType && !!approval.resourceId,
    );
    const unboundPending = pendingApprovals.filter(
      (approval) => !approval.executionId || !approval.resourceType || !approval.resourceId,
    );

    const mergedWithSealedWorkspace = mergedEvents.filter((merged) =>
      sealedEvents.some((sealed) => sealed.executionId && sealed.executionId === merged.executionId),
    );

    const checks = [
      { name: 'canonical_repository_identity', passed: repositories.length === 1 && canonical.externalId === '1373462743' },
      { name: 'implementation_review_identity_separation', passed: implementation.id !== review.id },
      { name: 'security_suite_latest_passed', passed: securityPayload.passed === true && Number(securityPayload.totalChecks) >= 9 },
      { name: 'self_approval_boundary_observed', passed: selfDenied > 0 },
      { name: 'agent_merge_boundary_observed', passed: mergeDenied >= 2 },
      { name: 'exact_independent_approval_observed', passed: exactApprovals.length > 0 },
      { name: 'merge_approval_provenance_observed', passed: boundMergeRequests.length > 0 },
      { name: 'pending_approvals_have_first_class_provenance', passed: unboundPending.length === 0 },
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
        firstClassBound: boundPending.length,
        unbound: unboundPending.map((approval) => ({
          id: approval.id,
          action: approval.action,
          taskId: approval.taskId,
        })),
      },
      evidence: {
        exactIndependentApprovals: exactApprovals.length,
        boundMergeApprovalRequests: boundMergeRequests.length,
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
