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
    },
  });

  await prisma.task.update({
    where: { id: execution.taskId },
    data: { status: 'WAITING_APPROVAL', requiresHumanApproval: true },
  });

  await prisma.auditEvent.create({
    data: {
      taskId: execution.taskId,
      executionId,
      eventType: 'merge.approval.requested',
      actorType: 'system',
      actorId: 'gitagent',
      payload: {
        approvalId: approval.id,
        executionId,
        pullRequestNumber,
        resourceType: approval.resourceType,
        resourceId: approval.resourceId,
        reviewApprovalAuditEventId: independent.id,
        reasonCode: 'policy.human_merge_approval_required',
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return approval;
}

export async function attemptMergeAsAgent(
  executionId: string,
  pullRequestNumber: number,
  actorAgentId: string,
) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution) throw new MergePolicyError('Execution not found.', 'merge.execution_not_found', 404);

  const reasonCode =
    actorAgentId === execution.agentId
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

  return { allowed: false as const, decision: 'DENY', reasonCode, githubRequestSent: false };
}

export async function recordHumanMergeDecision(
  approvalId: string,
  humanActorId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string,
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: { task: true },
  });
  if (!approval) throw new MergePolicyError('Merge approval not found.', 'merge.approval_not_found', 404);
  if (!approval.executionId || approval.resourceType !== 'github.pull_request' || !approval.resourceId) {
    throw new MergePolicyError(
      'Merge approval lacks first-class execution/PR provenance.',
      'merge.approval_provenance_missing',
      409,
    );
  }
  if (approval.action !== `pr.merge:${approval.resourceId}`) {
    throw new MergePolicyError(
      'Merge approval resource binding is inconsistent.',
      'merge.approval_binding_inconsistent',
      409,
    );
  }

  if (approval.status !== 'PENDING') {
    const existingDecision = approval.status === 'APPROVED' ? 'APPROVE' : approval.status === 'REJECTED' ? 'REJECT' : null;
    if (existingDecision === decision) {
      return {
        approvalId,
        status: approval.status,
        idempotentReplay: true,
        approvedByUserId: approval.actorId,
      };
    }
    throw new MergePolicyError(
      `Merge approval already decided: ${approval.status}.`,
      'merge.approval_conflict',
      409,
    );
  }

  const human = await prisma.user.findUnique({ where: { id: humanActorId } });
  if (!human) throw new MergePolicyError('Human actor not found.', 'merge.human_actor_not_found', 403);

  const now = new Date();
  const approved = decision === 'APPROVE';
  const [updated] = await prisma.$transaction([
    prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        actorId: human.id,
        decidedAt: now,
        reason: reason ?? null,
      },
    }),
    prisma.task.update({
      where: { id: approval.taskId },
      data: { status: approved ? 'WAITING_APPROVAL' : 'CANCELLED' },
    }),
    prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId: approval.executionId,
        eventType: approved ? 'merge.approval.approved' : 'merge.approval.rejected',
        actorType: 'human',
        actorId: human.id,
        payload: {
          approvalId: approval.id,
          executionId: approval.executionId,
          pullRequestNumber: Number(approval.resourceId),
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          decision,
          reason: reason ?? null,
          policyVersion: POLICY_VERSION,
        },
      },
    }),
  ]);

  return {
    approvalId: updated.id,
    status: updated.status,
    idempotentReplay: false,
    approvedByUserId: human.id,
  };
}

export async function executeApprovedMerge(approvalId: string) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: { task: { include: { repository: true } } },
  });

  if (!approval) throw new MergePolicyError('Merge approval not found.', 'merge.approval_not_found', 404);
  if (
    !approval.executionId ||
    approval.resourceType !== 'github.pull_request' ||
    !approval.resourceId ||
    !approval.action.startsWith('pr.merge:')
  ) {
    throw new MergePolicyError(
      'Merge approval lacks first-class execution/PR provenance.',
      'merge.approval_provenance_missing',
      409,
    );
  }

  const executionId = approval.executionId;
  const pullRequestNumber = Number(approval.resourceId);
  if (!Number.isInteger(pullRequestNumber) || approval.action !== `pr.merge:${pullRequestNumber}`) {
    throw new MergePolicyError(
      'Merge approval resource binding is inconsistent.',
      'merge.approval_binding_inconsistent',
      409,
    );
  }
  if (approval.status !== 'APPROVED') {
    throw new MergePolicyError(
      `Merge approval must be APPROVED before execution. Current status: ${approval.status}.`,
      'merge.approval_not_approved',
      409,
    );
  }

  const prior = await exactMergeAudit(executionId, pullRequestNumber);
  if (prior) {
    const payload = prior.payload as Record<string, unknown>;
    return {
      allowed: true as const,
      merged: true,
      idempotentReplay: true,
      recovered: Boolean(payload.recoveredFromGitHubState),
      pullRequestNumber,
      mergeSha: payload.mergeSha ?? null,
      approvalId,
      approvedByUserId: payload.approvedByUserId ?? approval.actorId,
    };
  }

  const independent = await exactReviewApproval(executionId, pullRequestNumber);
  if (!independent) {
    await auditMergeDenial({
      taskId: approval.taskId,
      executionId,
      approvalId,
      pullRequestNumber,
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

  const token = await createInstallationToken();
  const repo = approval.task.repository;
  const prResponse = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}`, {
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
    await sealExecutionWorkspace(executionId);
    await prisma.$transaction([
      prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
      prisma.auditEvent.create({
        data: {
          taskId: approval.taskId,
          executionId,
          eventType: 'github.pr.merged',
          actorType: 'system',
          actorId: 'gitagent-recovery',
          payload: {
            approvalId,
            executionId,
            pullRequestNumber,
            resourceType: approval.resourceType,
            resourceId: approval.resourceId,
            mergeSha: prState.merge_commit_sha ?? null,
            approvedByUserId: approval.actorId,
            reviewApprovalAuditEventId: independent.id,
            githubRequestSent: false,
            recoveredFromGitHubState: true,
            workspaceSealedBeforeMerge: true,
            recoveryReasonCode: 'merge.github_state_recovered',
            policyVersion: POLICY_VERSION,
          },
        },
      }),
    ]);
    await prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId,
        eventType: 'merge.recovery.completed',
        actorType: 'system',
        actorId: 'gitagent-recovery',
        payload: {
          approvalId,
          pullRequestNumber,
          mergeSha: prState.merge_commit_sha ?? null,
          reasonCode: 'merge.github_state_recovered',
          policyVersion: POLICY_VERSION,
        },
      },
    });
    return {
      allowed: true as const,
      merged: true,
      recovered: true,
      idempotentReplay: false,
      pullRequestNumber,
      mergeSha: prState.merge_commit_sha ?? null,
      approvalId,
      approvedByUserId: approval.actorId,
    };
  }

  if (prState.draft) {
    await auditMergeDenial({
      taskId: approval.taskId,
      executionId,
      approvalId,
      pullRequestNumber,
      actorType: 'system',
      actorId: 'gitagent',
      reasonCode: 'merge.pull_request_draft',
      message: 'Policy denied merge: pull request is still draft.',
      githubRequestSent: false,
    });
    throw new MergePolicyError(
      'Policy denied merge: pull request is still draft.',
      'merge.pull_request_draft',
      409,
    );
  }

  if (prState.state !== 'open') {
    const message = `Policy denied merge: pull request state is ${prState.state ?? 'unknown'}.`;
    await auditMergeDenial({
      taskId: approval.taskId,
      executionId,
      approvalId,
      pullRequestNumber,
      actorType: 'system',
      actorId: 'gitagent',
      reasonCode: 'merge.pull_request_not_open',
      message,
      githubRequestSent: false,
    });
    throw new MergePolicyError(message, 'merge.pull_request_not_open', 409);
  }

  await sealExecutionWorkspace(executionId);

  const response = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/merge`, {
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
  const result = (await response.json()) as { merged?: boolean; message?: string; sha?: string };

  if (!response.ok || !result.merged) {
    await prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId,
        eventType: 'github.pr.merge_failed',
        actorType: 'system',
        actorId: 'gitagent',
        payload: {
          approvalId,
          pullRequestNumber,
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          githubRequestSent: true,
          reasonCode: 'merge.github_merge_failed',
          message: result.message ?? `HTTP ${response.status}`,
          policyVersion: POLICY_VERSION,
        },
      },
    });
    throw new MergePolicyError(
      `GitHub merge failed: ${result.message ?? response.status}`,
      'merge.github_merge_failed',
      502,
    );
  }

  await prisma.$transaction([
    prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
    prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId,
        eventType: 'github.pr.merged',
        actorType: 'human',
        actorId: approval.actorId ?? 'unknown-human',
        payload: {
          approvalId,
          executionId,
          pullRequestNumber,
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          mergeSha: result.sha ?? null,
          approvedByUserId: approval.actorId,
          reviewApprovalAuditEventId: independent.id,
          githubRequestSent: true,
          recoveredFromGitHubState: false,
          workspaceSealedBeforeMerge: true,
          reasonCode: 'merge.completed',
          policyVersion: POLICY_VERSION,
        },
      },
    }),
  ]);

  return {
    allowed: true as const,
    merged: true,
    recovered: false,
    idempotentReplay: false,
    pullRequestNumber,
    mergeSha: result.sha ?? null,
    approvalId,
    approvedByUserId: approval.actorId,
  };
}

export async function executeHumanApprovedMerge(approvalId: string, humanActorId: string, reason?: string) {
  await recordHumanMergeDecision(approvalId, humanActorId, 'APPROVE', reason);
  return executeApprovedMerge(approvalId);
}
