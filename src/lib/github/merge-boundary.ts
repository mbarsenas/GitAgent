import { prisma } from '@/lib/db/prisma';
import { sealExecutionWorkspace } from '@/lib/governance/workspace';
import { createInstallationToken } from './auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const POLICY_VERSION = '2026-09-16.1';

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

export async function requestHumanMergeApproval(executionId: string, pullRequestNumber: number) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true, approvals: true } } },
  });
  if (!execution) throw new Error('Execution not found.');

  const independent = await exactReviewApproval(executionId, pullRequestNumber);
  if (!independent) {
    throw new Error('Exact independent GitAgent-Review approval is required before requesting human merge approval.');
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
  if (!execution) throw new Error('Execution not found.');

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

export async function executeHumanApprovedMerge(
  approvalId: string,
  humanActorId: string,
  reason?: string,
) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    include: { task: { include: { repository: true } } },
  });

  if (
    !approval ||
    !approval.executionId ||
    approval.resourceType !== 'github.pull_request' ||
    !approval.resourceId ||
    !approval.action.startsWith('pr.merge:')
  ) {
    throw new Error('Merge approval lacks first-class execution/PR provenance.');
  }

  const executionId = approval.executionId;
  const pullRequestNumber = Number(approval.resourceId);
  if (!Number.isInteger(pullRequestNumber) || approval.action !== `pr.merge:${pullRequestNumber}`) {
    throw new Error('Merge approval resource binding is inconsistent.');
  }

  if (approval.status === 'APPROVED') {
    const events = await prisma.auditEvent.findMany({
      where: { taskId: approval.taskId, executionId, eventType: 'github.pr.merged' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const prior = events.find((event) => payloadPr(event.payload) === pullRequestNumber);
    if (prior) {
      const payload = prior.payload as Record<string, unknown>;
      return {
        allowed: true as const,
        merged: true,
        idempotentReplay: true,
        pullRequestNumber,
        mergeSha: payload.mergeSha ?? null,
        approvalId,
        approvedByUserId: payload.approvedByUserId ?? approval.actorId,
      };
    }
    throw new Error('Approval is APPROVED but no exact merge audit event exists.');
  }

  if (approval.status !== 'PENDING') {
    throw new Error(`Merge approval already decided: ${approval.status}.`);
  }

  const human = await prisma.user.findUnique({ where: { id: humanActorId } });
  if (!human) throw new Error('Human actor not found.');

  const independent = await exactReviewApproval(executionId, pullRequestNumber);
  if (!independent) throw new Error('Exact independent GitAgent-Review approval is required before merge.');

  const token = await createInstallationToken();
  const repo = approval.task.repository;
  const prResponse = await fetch(
    `${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.token}`,
        'X-GitHub-Api-Version': VERSION,
        'User-Agent': 'GitAgent-Control',
      },
    },
  );
  if (!prResponse.ok) throw new Error(`GitHub PR lookup failed: ${prResponse.status}`);

  const prState = (await prResponse.json()) as { draft?: boolean; state?: string };
  if (prState.draft) throw new Error('Policy denied merge: pull request is still draft.');
  if (prState.state !== 'open') {
    throw new Error(`Policy denied merge: pull request state is ${prState.state ?? 'unknown'}.`);
  }

  // Freeze the reviewed implementation boundary before any external merge request.
  // If sealing fails, GitHub is untouched and the approval remains pending.
  await sealExecutionWorkspace(executionId);

  const response = await fetch(
    `${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/merge`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token.token}`,
        'X-GitHub-Api-Version': VERSION,
        'User-Agent': 'GitAgent-Control',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ merge_method: 'squash' }),
    },
  );
  const result = (await response.json()) as { merged?: boolean; message?: string; sha?: string };

  if (!response.ok || !result.merged) {
    await prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId,
        eventType: 'github.pr.merge_failed',
        actorType: 'human',
        actorId: human.id,
        payload: {
          approvalId,
          pullRequestNumber,
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          githubRequestSent: true,
          message: result.message ?? `HTTP ${response.status}`,
          policyVersion: POLICY_VERSION,
        },
      },
    });
    throw new Error(`GitHub merge failed: ${result.message ?? response.status}`);
  }

  await prisma.$transaction([
    prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: 'APPROVED',
        actorId: human.id,
        decidedAt: new Date(),
        reason: reason ?? null,
      },
    }),
    prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
    prisma.auditEvent.create({
      data: {
        taskId: approval.taskId,
        executionId,
        eventType: 'github.pr.merged',
        actorType: 'human',
        actorId: human.id,
        payload: {
          approvalId,
          executionId,
          pullRequestNumber,
          resourceType: approval.resourceType,
          resourceId: approval.resourceId,
          mergeSha: result.sha ?? null,
          approvedByUserId: human.id,
          reviewApprovalAuditEventId: independent.id,
          githubRequestSent: true,
          workspaceSealedBeforeMerge: true,
          policyVersion: POLICY_VERSION,
        },
      },
    }),
  ]);

  return {
    allowed: true as const,
    merged: true,
    idempotentReplay: false,
    pullRequestNumber,
    mergeSha: result.sha ?? null,
    approvalId,
    approvedByUserId: human.id,
  };
}
