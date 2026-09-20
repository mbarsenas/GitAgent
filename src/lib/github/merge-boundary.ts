import { prisma } from '@/lib/db/prisma';
import { sealExecutionWorkspace } from '@/lib/governance/workspace';
import { createInstallationToken } from './auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const POLICY_VERSION = '2026-09-16.1';

export class MergePolicyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'MergePolicyError';
  }
}

function payloadPr(payload: unknown) {
  return typeof payload === 'object' && payload !== null
    ? Number((payload as Record<string, unknown>).pullRequestNumber)
    : NaN;
}

async function exactReviewApproval(executionId: string, pullRequestNumber: number) {
  const events = await prisma.auditEvent.findMany({
    where: { executionId, eventType: 'github.review.approved' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return events.find((event) => {
    const payload = event.payload as Record<string, unknown>;
    return (
      payloadPr(payload) === pullRequestNumber &&
      payload.reviewGitHubApp === 'gitagent-review' &&
      !!payload.implementationAgentId &&
      !!payload.reviewerAgentId &&
      payload.implementationAgentId !== payload.reviewerAgentId
    );
  });
}

async function exactMergeAudit(executionId: string, pullRequestNumber: number) {
  const events = await prisma.auditEvent.findMany({
    where: { executionId, eventType: 'github.pr.merged' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return events.find((event) => payloadPr(event.payload) === pullRequestNumber);
}

async function auditMergeDenial(input: {
  taskId: string;
  executionId: string;
  approvalId: string;
  pullRequestNumber: number;
  actorType: 'system' | 'human';
  actorId: string;
  reasonCode: string;
  message: string;
  githubRequestSent: boolean;
}) {
  await prisma.auditEvent.create({
    data: {
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: 'policy.merge.denied',
      actorType: input.actorType,
      actorId: input.actorId,
      payload: {
        approvalId: input.approvalId,
        pullRequestNumber: input.pullRequestNumber,
        decision: 'DENY',
        reasonCode: input.reasonCode,
        message: input.message,
        githubRequestSent: input.githubRequestSent,
        policyVersion: POLICY_VERSION,
      },
    },
  });
}

export async function requestHumanMergeApproval(executionId: string, pullRequestNumber: number) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true, approvals: true } } },
  });
  if (!execution) throw new MergePolicyError('Execution not found.', 'merge.execution_not_found', 404);

  const independent = await exactReviewApproval(executionId, pullRequestNumber);
  if (!independent) {
    throw new MergePolicyError(
      'Exact independent GitAgent-Review approval is required before requesting human merge approval.',
      'merge.independent_review_required',
      409,
    );
  }

  const action = `pr.merge:${pullRequestNumber}`;
  const resourceId = String(pullRequestNumber);
  const existing = execution.task.approvals.find(
    (approval) =>
      approval.executionId === executionId &&
      approval.action === action &&
      approval.resourceType === 'github.pull_request' &&
      approval.resourceId === resourceId &&
      (approval.status === 'PENDING' || approval.status === 'APPROVED'),
  );
  if (existing) return existing;

  const approval = await prisma.approval.create({
    data: {
      taskId: execution.taskId,
      executionId,
      action,
      resourceType: 'github.pull_request',
      resourceId,
      status: 'PENDING',
      actorId: null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      taskId: execution.taskId,
      executionId,
      eventType: 'approval.requested',
      actorType: 'system',
      actorId: 'gitagent',
      payload: {
        approvalId: approval.id,
        action,
        resourceType: approval.resourceType,
        resourceId,
        pullRequestNumber,
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return approval;
}

export async function approveHumanMerge(input: {
  approvalId: string;
  userId: string;
  executionId: string;
  pullRequestNumber: number;
}) {
  const approval = await prisma.approval.findUnique({
    where: { id: input.approvalId },
    include: {
      task: {
        include: {
          repository: { include: { user: true } },
        },
      },
    },
  });

  if (!approval) throw new MergePolicyError('Approval not found.', 'merge.approval_not_found', 404);
  if (approval.executionId !== input.executionId) {
    throw new MergePolicyError('Approval does not belong to this execution.', 'merge.approval_execution_mismatch', 409);
  }
  if (approval.resourceType !== 'github.pull_request' || approval.resourceId !== String(input.pullRequestNumber)) {
    throw new MergePolicyError('Approval does not match this pull request.', 'merge.approval_resource_mismatch', 409);
  }
  if (approval.status !== 'PENDING') {
    if (approval.status === 'APPROVED' && approval.actorId === input.userId) return approval;
    throw new MergePolicyError('Approval is not pending.', 'merge.approval_not_pending', 409);
  }

  const repo = approval.task.repository;
  if (!repo.userId || repo.userId !== input.userId) {
    throw new MergePolicyError('User does not own this repository.', 'merge.repository_owner_mismatch', 403);
  }

  const updated = await prisma.approval.update({
    where: { id: approval.id },
    data: {
      status: 'APPROVED',
      actorId: input.userId,
      decidedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      taskId: approval.taskId,
      executionId: input.executionId,
      eventType: 'approval.approved',
      actorType: 'human',
      actorId: input.userId,
      payload: {
        approvalId: approval.id,
        pullRequestNumber: input.pullRequestNumber,
        repository: `${repo.owner}/${repo.name}`,
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return updated;
}

export async function recordHumanMergeDecision(
  approvalId: string,
  humanActorId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string,
) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  if (!approval) throw new MergePolicyError('Approval not found.', 'merge.approval_not_found', 404);
  if (!approval.executionId || approval.resourceType !== 'github.pull_request' || !approval.resourceId) {
    throw new MergePolicyError('Approval is not a GitHub pull request merge approval.', 'merge.approval_resource_mismatch', 409);
  }

  if (decision === 'APPROVE') {
    const updated = await approveHumanMerge({
      approvalId,
      userId: humanActorId,
      executionId: approval.executionId,
      pullRequestNumber: Number(approval.resourceId),
    });
    return { approval: updated, decision };
  }

  if (approval.status !== 'PENDING') {
    throw new MergePolicyError('Approval is not pending.', 'merge.approval_not_pending', 409);
  }

  const updated = await prisma.approval.update({
    where: { id: approvalId },
    data: { status: 'REJECTED', actorId: humanActorId, reason, decidedAt: new Date() },
  });
  await prisma.auditEvent.create({
    data: {
      taskId: updated.taskId,
      executionId: updated.executionId,
      eventType: 'approval.rejected',
      actorType: 'human',
      actorId: humanActorId,
      payload: { approvalId, reason: reason ?? null, policyVersion: POLICY_VERSION },
    },
  });
  return { approval: updated, decision };
}

export async function executeApprovedMerge(approvalId: string, executionId?: string, pullRequestNumber?: number) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: {
      task: {
        include: {
          repository: { include: { user: true } },
        },
      },
    },
  });
  if (!approval) throw new MergePolicyError('Approval not found.', 'merge.approval_not_found', 404);

  const resolvedExecutionId = executionId ?? approval.executionId ?? undefined;
  const resolvedPullRequestNumber = pullRequestNumber ?? Number(approval.resourceId);
  if (!resolvedExecutionId || !Number.isFinite(resolvedPullRequestNumber)) {
    throw new MergePolicyError('Approval is missing execution or pull request context.', 'merge.approval_resource_mismatch', 409);
  }

  if (approval.executionId !== resolvedExecutionId) {
    throw new MergePolicyError('Approval does not belong to this execution.', 'merge.approval_execution_mismatch', 409);
  }
  if (approval.status !== 'APPROVED' || !approval.actorId) {
    throw new MergePolicyError('Human approval is required before merge.', 'merge.human_approval_required', 409);
  }

  const prior = await exactMergeAudit(resolvedExecutionId, resolvedPullRequestNumber);
  if (prior) {
    const payload = prior.payload as Record<string, unknown>;
    return {
      merged: true as const,
      idempotentReplay: true,
      recovered: Boolean(payload.recoveredFromGitHubState),
      pullRequestNumber: resolvedPullRequestNumber,
      mergeSha: payload.mergeSha ?? null,
      approvalId,
      approvedByUserId: payload.approvedByUserId ?? approval.actorId,
    };
  }

  const independent = await exactReviewApproval(resolvedExecutionId, resolvedPullRequestNumber);
  if (!independent) {
    await auditMergeDenial({
      taskId: approval.taskId,
      executionId: resolvedExecutionId,
      approvalId,
      pullRequestNumber: resolvedPullRequestNumber,
      actorType: 'system',
      actorId: 'gitagent',
      reasonCode: 'merge.independent_review_required',
      message: 'Exact independent GitAgent-Review approval is required before merge.',
      githubRequestSent: false,
    });
    throw new MergePolicyError(
      'Exact independent GitAgent-Review approval is required before merge.',
      'merge.independent_review_required',
      409,
    );
  }

  const repo = approval.task.repository;
  if (!repo.user?.githubInstallationId) {
    throw new MergePolicyError(
      'Repository owner does not have a GitHub App installation linked.',
      'merge.github_installation_missing',
      409,
    );
  }
  const token = await createInstallationToken(repo.user.githubInstallationId);
  const prResponse = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${resolvedPullRequestNumber}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.token}`,
      'X-GitHub-Api-Version': VERSION,
      'User-Agent': 'GitAgent-Control',
    },
  });
  if (!prResponse.ok) {
    throw new MergePolicyError(
      `GitHub PR lookup failed: ${prResponse.status}`,
      'merge.github_pr_lookup_failed',
      502,
    );
  }

  const prState = (await prResponse.json()) as {
    draft?: boolean;
    state?: string;
    merged?: boolean;
    merge_commit_sha?: string | null;
  };

  if (prState.merged) {
    await sealExecutionWorkspace(resolvedExecutionId);
    await prisma.$transaction([
      prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
      prisma.auditEvent.create({
        data: {
          taskId: approval.taskId,
          executionId: resolvedExecutionId,
          eventType: 'github.pr.merged',
          actorType: 'human',
          actorId: approval.actorId,
          payload: {
            repository: `${repo.owner}/${repo.name}`,
            pullRequestNumber: resolvedPullRequestNumber,
            mergeSha: prState.merge_commit_sha ?? null,
            approvalId,
            approvedByUserId: approval.actorId,
            recoveredFromGitHubState: true,
            policyVersion: POLICY_VERSION,
          },
        },
      }),
    ]);
    return {
      merged: true as const,
      idempotentReplay: false,
      recovered: true,
      pullRequestNumber: resolvedPullRequestNumber,
      mergeSha: prState.merge_commit_sha ?? null,
      approvalId,
      approvedByUserId: approval.actorId,
    };
  }

  if (prState.draft || prState.state !== 'open') {
    throw new MergePolicyError('Pull request is not mergeable.', 'merge.pr_not_mergeable', 409);
  }

  const mergeResponse = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${resolvedPullRequestNumber}/merge`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.token}`,
      'X-GitHub-Api-Version': VERSION,
      'User-Agent': 'GitAgent-Control',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: 'squash' }),
  });
  const mergeBody = (await mergeResponse.json()) as { merged?: boolean; sha?: string; message?: string };
  if (!mergeResponse.ok || !mergeBody.merged) {
    throw new MergePolicyError(
      mergeBody.message || `GitHub merge failed: ${mergeResponse.status}`,
      'merge.github_merge_failed',
      502,
    );
  }

  await sealExecutionWorkspace(resolvedExecutionId);
  await prisma.$transaction([
    prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
    prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId: resolvedExecutionId,
        eventType: 'github.pr.merged',
        actorType: 'human',
        actorId: approval.actorId,
        payload: {
          repository: `${repo.owner}/${repo.name}`,
          pullRequestNumber: resolvedPullRequestNumber,
          mergeSha: mergeBody.sha ?? null,
          approvalId,
          approvedByUserId: approval.actorId,
          recoveredFromGitHubState: false,
          policyVersion: POLICY_VERSION,
        },
      },
    }),
  ]);

  return {
    merged: true as const,
    idempotentReplay: false,
    recovered: false,
    pullRequestNumber: resolvedPullRequestNumber,
    mergeSha: mergeBody.sha ?? null,
    approvalId,
    approvedByUserId: approval.actorId,
  };
}

export async function executeHumanApprovedMerge(approvalId: string, humanActorId: string, reason?: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
  if (!approval?.executionId || !approval.resourceId) {
    throw new MergePolicyError('Approval is missing execution or pull request context.', 'merge.approval_resource_mismatch', 409);
  }
  await recordHumanMergeDecision(approvalId, humanActorId, 'APPROVE', reason);
  return executeApprovedMerge(approvalId, approval.executionId, Number(approval.resourceId));
}

export async function attemptMergeAsAgent(executionId: string, pullRequestNumber: number, actorAgentId: string) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution) throw new MergePolicyError('Execution not found.', 'merge.execution_not_found', 404);

  const reasonCode = actorAgentId === execution.agentId
    ? 'policy.implementation_agent_merge_denied'
    : 'policy.agent_merge_denied';

  await prisma.auditEvent.create({
    data: {
      taskId: execution.taskId,
      executionId,
      eventType: 'policy.merge.denied',
      actorType: 'agent',
      actorId: actorAgentId,
      payload: {
        pullRequestNumber,
        decision: 'DENY',
        reasonCode,
        githubRequestSent: false,
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return {
    allowed: false as const,
    decision: 'DENY' as const,
    reasonCode,
    githubRequestSent: false,
  };
}
