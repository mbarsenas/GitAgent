import { reviewPullRequestDiff } from './independent-review';
import { requireCompleteDiff, reviewMatchesHead } from './review-verdict';
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
    throw new Error(`GitHub API request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

async function findExactEvent(
  executionId: string,
  actorAgentId: string,
  eventType: string,
  pullRequestNumber: number,
  headSha?: string,
) {
  const events = await prisma.auditEvent.findMany({
    where: { executionId, actorId: actorAgentId, eventType },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return events.find((event) => payloadMatchesPr(event.payload, pullRequestNumber) && (!headSha || reviewMatchesHead(event.payload, headSha)));
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
    include: { task: { include: { repository: true } }, agent: true, workspace: true },
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
      allowed: false as const,
      decision: 'DENY' as const,
      reasonCode: 'policy.review_app_not_configured',
      githubRequestSent: false,
    };
  }

  const creation = await prisma.auditEvent.findMany({ where: { executionId, eventType: 'github.pr.created' } });
  if (!creation.some(e => payloadMatchesPr(e.payload, pullRequestNumber))) throw new Error('Pull request is not bound to this execution.');
  const installation = await createReviewInstallationToken(repo.owner, repo.name);
  const prUrl = `${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}`;
  const pr = await github<{ state: string; head: { sha: string; ref: string; repo: { full_name: string } | null }; changed_files: number }>(prUrl, installation.token);
  if (pr.state !== 'open' || pr.head.ref !== execution.workspace?.branch || pr.head.repo?.full_name.toLowerCase() !== repository.toLowerCase()) {
    throw new Error('Pull request does not match the active execution branch.');
  }
  const headSha = pr.head.sha;
  const eventType = action === 'REVIEW' ? 'github.review.created' : 'github.review.approved';
  const prior = await findExactEvent(executionId, actorAgentId, eventType, pullRequestNumber, headSha);
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
      headSha,
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

  let reviewSummary = 'Independent review approved this exact commit.';
  let reviewVerdict = 'APPROVE';
  if (action === 'REVIEW') {
    const files: Array<{ filename: string; patch?: string }> = [];
    if (pr.changed_files > 100) throw new Error('Pull request is too large for independent review.');
    files.push(...await github<Array<{ filename: string; patch?: string }>>(`${prUrl}/files?per_page=100`, installation.token));
    requireCompleteDiff(files, pr.changed_files);
    const verdict = await reviewPullRequestDiff({ goal: execution.task.goal, repository, headSha, files });
    reviewSummary = [verdict.summary, ...verdict.findings].join('\n\n');
    reviewVerdict = verdict.verdict;
    if (reviewVerdict !== 'APPROVE') {
      await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId,
        eventType: 'github.review.changes_requested', actorType: 'agent', actorId: actorAgentId,
        payload: { repository, pullRequestNumber, headSha, reviewVerdict, summary: reviewSummary, policyVersion: POLICY_VERSION } } });
      return { allowed: false as const, decision: 'DENY' as const, reasonCode: 'policy.independent_review_changes_requested', githubRequestSent: false };
    }
  }
  const current = await github<{ head: { sha: string } }>(prUrl, installation.token);
  if (current.head.sha !== headSha) throw new Error('Pull request changed during review; review the new commit.');
  const event = action === 'REVIEW' ? 'COMMENT' : 'APPROVE';
  const result = await github<{ id: number; state: string; html_url: string }>(
    `${API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/reviews`,
    installation.token,
    {
      method: 'POST',
      body: JSON.stringify({
        event,
        commit_id: headSha,
        body:
          action === 'REVIEW'
            ? `GitAgent independent review by ${reviewer.name} (${reviewer.id}) for ${headSha}.\n\n${reviewSummary}`
            : `GitAgent independent approval by ${reviewer.name} (${reviewer.id}) for reviewed commit ${headSha}.`,
      }),
    },
  );

  if (action === 'APPROVE' && result.state !== 'APPROVED') throw new Error('GitHub did not accept the independent approval.');

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
        headSha,
        reviewVerdict,
        reviewSummary,
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
