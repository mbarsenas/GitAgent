import { prisma } from '@/lib/db/prisma';
import { createReviewInstallationToken, isReviewAppConfigured } from './review-auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const POLICY_VERSION = '2026-09-16.1';

type ReviewAction = 'REVIEW' | 'APPROVE';

function payloadMatchesPr(payload: unknown, pullRequestNumber: number) {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Number((payload as Record<string, unknown>).pullRequestNumber) === pullRequestNumber
  );
}

async function github<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': VERSION,
      'User-Agent': 'GitAgent-Review',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

async function findExactEvent(
  executionId: string,
  actorAgentId: string,
  eventType: string,
  pullRequestNumber: number,
) {
  const events = await prisma.auditEvent.findMany({
    where: { executionId, actorId: actorAgentId, eventType },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return events.find((event) => payloadMatchesPr(event.payload, pullRequestNumber));
}

async function auditReviewDeny(input: {
  taskId: string;
  executionId: string;
  actorAgentId: string;
  repository: string;
  pullRequestNumber: number;
  reasonCode: string;
}) {
  await prisma.auditEvent.create({
    data: {
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: 'policy.review.denied',
      actorType: 'agent',
      actorId: input.actorAgentId,
      payload: {
        repository: input.repository,
        pullRequestNumber: input.pullRequestNumber,
        decision: 'DENY',
        reasonCode: input.reasonCode,
        githubRequestSent: false,
        policyVersion: POLICY_VERSION,
      },
    },
  });
}

export async function performPullRequestReview(
  executionId: string,
  pullRequestNumber: number,
  actorAgentId: string,
  action: ReviewAction,
) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true } }, agent: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const repo = execution.task.repository;
  const repository = `${repo.owner}/${repo.name}`;

  if (actorAgentId === execution.agentId) {
    await auditReviewDeny({
      taskId: execution.taskId,
      executionId,
      actorAgentId,
      repository,
      pullRequestNumber,
      reasonCode: 'policy.self_approval_denied',
    });
    return {
      allowed: false as const,
      decision: 'DENY' as const,
      reasonCode: 'policy.self_approval_denied',
      githubRequestSent: false,
    };
  }

  const reviewer = await prisma.agent.findUnique({ where: { id: actorAgentId } });
  if (!reviewer || reviewer.status !== 'ACTIVE') {
    await auditReviewDeny({
      taskId: execution.taskId,
      executionId,
      actorAgentId,
      repository,
      pullRequestNumber,
      reasonCode: 'policy.review_agent_inactive',
    });
    return {
      allowed: false as const,
      decision: 'DENY' as const,
      reasonCode: 'policy.review_agent_inactive',
      githubRequestSent: false,
    };
  }

  const grant = await prisma.capabilityGrant.findFirst({
    where: {
      agentId: actorAgentId,
      capability: 'review.approve',
      effect: 'ALLOW',
      OR: [{ resource: '*' }, { resource: repo.id }, { resource: repository }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });

  if (!grant) {
    await auditReviewDeny({
      taskId: execution.taskId,
      executionId,
      actorAgentId,
      repository,
      pullRequestNumber,
      reasonCode: 'policy.capability_not_granted',
    });
    return {
      allowed: false as const,
      decision: 'DENY' as const,
      reasonCode: 'policy.capability_not_granted',
      githubRequestSent: false,
    };
  }

  if (!isReviewAppConfigured()) {
    return {
      allowed: true as const,
      decision: 'ALLOW' as const,
      reasonCode: 'policy.review_app_not_configured',
      githubRequestSent: false,
    };
  }

  const eventType = action === 'REVIEW' ? 'github.review.created' : 'github.review.approved';
  const prior = await findExactEvent(executionId, actorAgentId, eventType, pullRequestNumber);
  if (prior) {
    const payload = prior.payload as Record<string, unknown>;
    return {
      allowed: true as const,
      decision: 'ALLOW' as const,
      reasonCode:
        action === 'REVIEW'
          ? 'policy.independent_review_allowed'
          : 'policy.independent_approval_allowed',
      githubRequestSent: false,
      idempotentReplay: true,
      approvalSubmitted: action === 'APPROVE',
      githubReviewId: payload.githubReviewId,
      githubReviewState: payload.githubReviewState,
      reviewGitHubApp: payload.reviewGitHubApp,
      reviewerAgentId: actorAgentId,
      implementationAgentId: execution.agentId,
      capabilityGrantId: grant.id,
    };
  }

  if (action === 'APPROVE') {
    const review = await findExactEvent(
      executionId,
      actorAgentId,
      'github.review.created',
      pullRequestNumber,
    );
    if (!review) {
      await auditReviewDeny({
        taskId: execution.taskId,
        executionId,
        actorAgentId,
        repository,
        pullRequestNumber,
        reasonCode: 'policy.review_required_before_approval',
      });
      return {
        allowed: false as const,
        decision: 'DENY' as const,
        reasonCode: 'policy.review_required_before_approval',
        githubRequestSent: false,
      };
    }
  }

  const installation = await createReviewInstallationToken();
  const event = action === 'REVIEW' ? 'COMMENT' : 'APPROVE';
  const result = await github<{ id: number; state: string; html_url: string }>(
    `${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/reviews`,
    installation.token,
    {
      method: 'POST',
      body: JSON.stringify({
        event,
        body:
          action === 'REVIEW'
            ? `GitAgent independent review by ${reviewer.name} (${reviewer.id}).`
            : `GitAgent independent approval by ${reviewer.name} (${reviewer.id}).`,
      }),
    },
  );

  const reasonCode =
    action === 'REVIEW'
      ? 'policy.independent_review_allowed'
      : 'policy.independent_approval_allowed';

  await prisma.auditEvent.create({
    data: {
      taskId: execution.taskId,
      executionId,
      eventType,
      actorType: 'agent',
      actorId: actorAgentId,
      payload: {
        repository,
        pullRequestNumber,
        githubReviewId: result.id,
        githubReviewState: result.state,
        githubReviewUrl: result.html_url,
        implementationAgentId: execution.agentId,
        reviewerAgentId: actorAgentId,
        reviewGitHubApp: installation.appSlug,
        capabilityGrantId: grant.id,
        decision: 'ALLOW',
        reasonCode,
        policyVersion: POLICY_VERSION,
        metadata: {
          githubRequestSent: true,
          separateGitHubPrincipal: true,
          writableImplementationWorkspaceInherited: false,
        },
      },
    },
  });

  return {
    allowed: true as const,
    decision: 'ALLOW' as const,
    reasonCode,
    githubRequestSent: true,
    approvalSubmitted: action === 'APPROVE',
    githubReviewId: result.id,
    githubReviewState: result.state,
    githubReviewUrl: result.html_url,
    reviewGitHubApp: installation.appSlug,
    reviewerAgentId: actorAgentId,
    implementationAgentId: execution.agent.id,
    capabilityGrantId: grant.id,
  };
}

export async function attemptPullRequestApproval(
  executionId: string,
  pullRequestNumber: number,
  actorAgentId: string,
) {
  const prior = await findExactEvent(
    executionId,
    actorAgentId,
    'github.review.created',
    pullRequestNumber,
  );

  return performPullRequestReview(
    executionId,
    pullRequestNumber,
    actorAgentId,
    prior ? 'APPROVE' : 'REVIEW',
  );
}
