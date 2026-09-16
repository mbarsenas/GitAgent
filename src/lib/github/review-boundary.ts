import { prisma } from '@/lib/db/prisma';
import { createInstallationToken } from './auth';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

async function github<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'GitAgent-Control',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return (await response.json()) as T;
}

export async function attemptPullRequestApproval(executionId: string, pullRequestNumber: number, actorAgentId: string) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId }, include: { task: { include: { repository: true } }, agent: true } });
  if (!execution) throw new Error('Execution not found.');
  const repo = execution.task.repository;
  const repository = `${repo.owner}/${repo.name}`;

  if (actorAgentId === execution.agentId) {
    await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId: execution.id, eventType: 'policy.review.denied', actorType: 'agent', actorId: actorAgentId, payload: { repository, pullRequestNumber, requestedCapability: 'review.approve', decision: 'DENY', policyVersion: '2026-09-16.1', reasonCode: 'policy.self_approval_denied', severity: 'high', implementationAgentId: execution.agentId, metadata: { explanation: 'GitAgent denied the approval because the requesting identity is the same implementation agent that produced the governed change.', githubRequestSent: false } } } });
    return { allowed: false as const, decision: 'DENY', reasonCode: 'policy.self_approval_denied', githubRequestSent: false, message: 'Implementation agents cannot approve their own governed changes.' };
  }

  const reviewer = await prisma.agent.findUnique({ where: { id: actorAgentId } });
  if (!reviewer || reviewer.status !== 'ACTIVE') throw new Error('Review agent is not active.');

  const grant = await prisma.capabilityGrant.findFirst({ where: { agentId: actorAgentId, capability: 'review.approve', effect: 'ALLOW', OR: [{ resource: '*' }, { resource: repo.id }, { resource: repository }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }] } });
  if (!grant) {
    await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId: execution.id, eventType: 'policy.review.denied', actorType: 'agent', actorId: actorAgentId, payload: { repository, pullRequestNumber, requestedCapability: 'review.approve', decision: 'DENY', policyVersion: '2026-09-16.1', reasonCode: 'policy.capability_not_granted', severity: 'high', metadata: { explanation: 'The requesting review identity has no active review.approve grant.', githubRequestSent: false } } } });
    return { allowed: false as const, decision: 'DENY', reasonCode: 'policy.capability_not_granted', githubRequestSent: false };
  }

  const priorReview = await prisma.auditEvent.findFirst({ where: { executionId: execution.id, actorId: actorAgentId, eventType: 'github.review.created' }, orderBy: { createdAt: 'desc' } });
  if (!priorReview) {
    const installation = await createInstallationToken();
    const review = await github<{ id: number; state: string; html_url: string }>(`${GITHUB_API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/reviews`, installation.token, { method: 'POST', body: JSON.stringify({ event: 'COMMENT', body: `GitAgent independent review boundary passed. Reviewer identity: ${reviewer.name} (${reviewer.id}). This review identity is distinct from implementation agent ${execution.agentId}.` }) });
    await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId: execution.id, eventType: 'github.review.created', actorType: 'agent', actorId: actorAgentId, payload: { repository, pullRequestNumber, githubReviewId: review.id, githubReviewState: review.state, githubReviewUrl: review.html_url, implementationAgentId: execution.agentId, reviewerAgentId: actorAgentId, capabilityGrantId: grant.id, installationTokenExpiresAt: installation.expires_at, decision: 'ALLOW', policyVersion: '2026-09-16.1', reasonCode: 'policy.independent_review_allowed', severity: 'info', metadata: { explanation: 'GitAgent authorized a separate review identity and created a non-approving GitHub review. Approval remains separately governed.', githubRequestSent: true, writableImplementationWorkspaceInherited: false } } } });
    return { allowed: true as const, decision: 'ALLOW', reasonCode: 'policy.independent_review_allowed', githubRequestSent: true, githubReviewId: review.id, githubReviewState: review.state, githubReviewUrl: review.html_url, reviewerAgentId: actorAgentId, implementationAgentId: execution.agentId, capabilityGrantId: grant.id, approvalSubmitted: false };
  }

  const installation = await createInstallationToken();
  const approval = await github<{ id: number; state: string; html_url: string }>(`${GITHUB_API}/repos/${repo.owner}/${repo.name}/pulls/${pullRequestNumber}/reviews`, installation.token, { method: 'POST', body: JSON.stringify({ event: 'APPROVE', body: `GitAgent governed approval by independent reviewer ${reviewer.name} (${reviewer.id}).` }) });

  await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId: execution.id, eventType: 'github.review.approved', actorType: 'agent', actorId: actorAgentId, payload: { repository, pullRequestNumber, githubReviewId: approval.id, githubReviewState: approval.state, githubReviewUrl: approval.html_url, implementationAgentId: execution.agentId, reviewerAgentId: actorAgentId, capabilityGrantId: grant.id, installationTokenExpiresAt: installation.expires_at, decision: 'ALLOW', policyVersion: '2026-09-16.1', reasonCode: 'policy.independent_approval_allowed', severity: 'info', metadata: { explanation: 'GitAgent allowed approval only after a distinct review identity passed the independent-review boundary.', githubRequestSent: true, writableImplementationWorkspaceInherited: false } } } });

  return { allowed: true as const, decision: 'ALLOW', reasonCode: 'policy.independent_approval_allowed', githubRequestSent: true, approvalSubmitted: true, githubReviewId: approval.id, githubReviewState: approval.state, githubReviewUrl: approval.html_url, reviewerAgentId: actorAgentId, implementationAgentId: execution.agentId, capabilityGrantId: grant.id };
}
