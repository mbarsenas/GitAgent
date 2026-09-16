import { prisma } from '@/lib/db/prisma';
import { createInstallationToken } from './auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';

async function github<T>(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': VERSION,
      'User-Agent': 'GitAgent-Control',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return (await response.json()) as T;
}

async function requireGrant(agentId: string, capability: string, repositoryId: string, fullName: string) {
  const grant = await prisma.capabilityGrant.findFirst({
    where: {
      agentId,
      capability,
      effect: 'ALLOW',
      OR: [{ resource: '*' }, { resource: repositoryId }, { resource: fullName }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });
  if (!grant) throw new Error(`Policy denied ${capability}: no active ALLOW capability grant.`);
  return grant;
}

export async function createGovernedChange(executionId: string, branch: string) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true } }, agent: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const { task, agent } = execution;
  const repo = task.repository;
  const fullName = `${repo.owner}/${repo.name}`;
  if (task.agentId !== agent.id) throw new Error('Execution agent is not assigned to this task.');
  if (!branch.startsWith('gitagent/')) throw new Error('Policy denied branch.write: target is not a GitAgent branch.');

  const writeGrant = await requireGrant(agent.id, 'branch.write', repo.id, fullName);
  const prGrant = await requireGrant(agent.id, 'pr.create', repo.id, fullName);
  const installation = await createInstallationToken();

  const path = `.gitagent/proofs/${execution.id}.md`;
  const text = `# GitAgent governed execution\n\nExecution: ${execution.id}\nTask: ${task.id}\nAgent: ${agent.name}\nRepository: ${fullName}\nBranch: ${branch}\n\nCreated by GitAgent-Control after policy authorization using a short-lived GitHub App installation token.\n`;
  const encoded = Buffer.from(text).toString('base64');

  const commit = await github<{ commit: { sha: string; html_url: string } }>(
    `${API}/repos/${repo.owner}/${repo.name}/contents/${path}`,
    installation.token,
    { method: 'PUT', body: JSON.stringify({ message: `chore: record governed execution ${execution.id}`, content: encoded, branch }) },
  );

  await prisma.auditEvent.create({ data: {
    taskId: task.id, executionId: execution.id, eventType: 'github.commit.created', actorType: 'agent', actorId: agent.id,
    payload: { repository: fullName, branch, path, commitSha: commit.commit.sha, capabilityGrantId: writeGrant.id, policyVersion: '2026-09-16.1', result: 'success' },
  }});

  const pr = await github<{ number: number; html_url: string; draft: boolean }>(
    `${API}/repos/${repo.owner}/${repo.name}/pulls`,
    installation.token,
    { method: 'POST', body: JSON.stringify({ title: `GitAgent governed execution ${execution.id.slice(-8)}`, head: branch, base: repo.defaultBranch, draft: true, body: `Governed by GitAgent-Control.\n\nTask: ${task.title}\nExecution: ${execution.id}\nImplementation agent: ${agent.name}\n\nAwaiting independent review.` }) },
  );

  await prisma.auditEvent.create({ data: {
    taskId: task.id, executionId: execution.id, eventType: 'github.pr.created', actorType: 'agent', actorId: agent.id,
    payload: { repository: fullName, branch, baseBranch: repo.defaultBranch, pullRequestNumber: pr.number, pullRequestUrl: pr.html_url, draft: pr.draft, capabilityGrantId: prGrant.id, policyVersion: '2026-09-16.1', result: 'success' },
  }});

  return { repository: fullName, branch, path, commitSha: commit.commit.sha, pullRequestNumber: pr.number, pullRequestUrl: pr.html_url, draft: pr.draft };
}
