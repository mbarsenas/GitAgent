import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const executionId = url.searchParams.get('executionId');
    if (!executionId) {
      return NextResponse.json({ ok: false, error: 'executionId is required.' }, { status: 400 });
    }

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        agent: true,
        workspace: true,
        task: { include: { repository: true, approvals: true } },
      },
    });
    if (!execution) {
      return NextResponse.json({ ok: false, error: 'Execution not found.' }, { status: 404 });
    }

    const events = await prisma.auditEvent.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const payload = (event: (typeof events)[number]) => event.payload as Record<string, unknown>;
    const prEvent = events.find((event) => event.eventType === 'github.pr.created');
    const pullRequestNumber = prEvent ? Number(payload(prEvent).pullRequestNumber) : NaN;
    const exactPrEvent = (type: string) =>
      events.find(
        (event) =>
          event.eventType === type &&
          (!Number.isFinite(pullRequestNumber) || Number(payload(event).pullRequestNumber) === pullRequestNumber),
      );

    const review = exactPrEvent('github.review.created');
    const reviewApproval = exactPrEvent('github.review.approved');
    const mergeRequest = exactPrEvent('merge.approval.requested');
    const implementationMergeDeny = events.find(
      (event) => event.eventType === 'policy.merge.denied' && event.actorId === execution.agentId,
    );
    const reviewerId = reviewApproval ? String(payload(reviewApproval).reviewerAgentId ?? '') : '';
    const reviewerMergeDeny = events.find(
      (event) => event.eventType === 'policy.merge.denied' && event.actorId === reviewerId,
    );

    const mergeApproval = Number.isFinite(pullRequestNumber)
      ? execution.task.approvals.find(
          (item) =>
            item.executionId === executionId &&
            item.action === `pr.merge:${pullRequestNumber}` &&
            item.resourceType === 'github.pull_request' &&
            item.resourceId === String(pullRequestNumber),
        )
      : undefined;

    const workspaceProvisioned = events.find((event) => event.eventType === 'workspace.provisioned');
    const branchCreated = events.find((event) => event.eventType === 'github.branch.created');
    const commitCreated = events.find((event) => event.eventType === 'github.commit.created');
    const workspaceBound =
      !!execution.workspace &&
      execution.workspace.executionId === executionId &&
      execution.workspace.ownerAgentId === execution.agentId &&
      execution.workspace.repositoryId === execution.task.repositoryId &&
      !!execution.workspace.branch &&
      !!branchCreated &&
      payload(branchCreated).workspaceId === execution.workspace.id &&
      payload(branchCreated).workspaceKey === execution.workspace.workspaceKey &&
      !!commitCreated &&
      payload(commitCreated).workspaceId === execution.workspace.id &&
      payload(commitCreated).workspaceKey === execution.workspace.workspaceKey;

    const checks = [
      { name: 'canonical_repository', passed: execution.task.repository.externalId === '1373462743' },
      { name: 'sponsorship', passed: !!events.find((event) => event.eventType === 'sponsorship.granted') },
      { name: 'workspace_provisioned', passed: !!execution.workspace && !!workspaceProvisioned },
      { name: 'workspace_write_boundary_bound', passed: workspaceBound },
      { name: 'branch_created', passed: !!branchCreated },
      { name: 'commit_created', passed: !!commitCreated },
      { name: 'reviewable_pr_created', passed: !!prEvent && payload(prEvent).draft === false },
      {
        name: 'self_approval_denied',
        passed: !!events.find(
          (event) => event.eventType === 'policy.review.denied' && event.actorId === execution.agentId,
        ),
      },
      { name: 'independent_review_exact_pr', passed: !!review && payload(review).reviewGitHubApp === 'gitagent-review' },
      {
        name: 'independent_approval_exact_pr',
        passed:
          !!reviewApproval &&
          payload(reviewApproval).reviewGitHubApp === 'gitagent-review' &&
          reviewerId !== execution.agentId,
      },
      { name: 'implementation_merge_denied', passed: !!implementationMergeDeny },
      { name: 'reviewer_merge_denied', passed: !!reviewerMergeDeny },
      {
        name: 'human_merge_gate_bound',
        passed:
          !!mergeRequest &&
          payload(mergeRequest).executionId === executionId &&
          !!mergeApproval &&
          payload(mergeRequest).approvalId === mergeApproval.id &&
          payload(mergeRequest).resourceType === mergeApproval.resourceType &&
          payload(mergeRequest).resourceId === mergeApproval.resourceId,
      },
      {
        name: 'execution_outcome_audited',
        passed: !!events.find(
          (event) => event.eventType === 'execution.completed' || event.eventType === 'execution.failed',
        ),
      },
    ];

    const failed = checks.filter((check) => !check.passed);
    return NextResponse.json({
      ok: true,
      passed: failed.length === 0,
      executionId,
      taskId: execution.taskId,
      pullRequestNumber: Number.isFinite(pullRequestNumber) ? pullRequestNumber : null,
      taskStatus: execution.task.status,
      executionStatus: execution.status,
      workspace: execution.workspace
        ? {
            id: execution.workspace.id,
            workspaceKey: execution.workspace.workspaceKey,
            branch: execution.workspace.branch,
            writable: execution.workspace.writable,
            status: execution.workspace.status,
          }
        : null,
      summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
      checks,
      evidence: {
        reviewAuditEventId: review?.id ?? null,
        approvalAuditEventId: reviewApproval?.id ?? null,
        mergeApprovalAuditEventId: mergeRequest?.id ?? null,
        mergeApproval: mergeApproval
          ? {
              id: mergeApproval.id,
              executionId: mergeApproval.executionId,
              action: mergeApproval.action,
              resourceType: mergeApproval.resourceType,
              resourceId: mergeApproval.resourceId,
              status: mergeApproval.status,
            }
          : null,
        pendingHumanApprovals: execution.task.approvals
          .filter((item) => item.status === 'PENDING')
          .map((item) => ({
            id: item.id,
            executionId: item.executionId,
            action: item.action,
            resourceType: item.resourceType,
            resourceId: item.resourceId,
          })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
