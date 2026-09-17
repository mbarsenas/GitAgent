import { prisma } from '@/lib/db/prisma';
import { grantMatchesTaskScope } from '@/lib/policy/task-scope';
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
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function createGovernedBranch(executionId: string) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true } }, agent: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const { task, agent } = execution;
  const repo = task.repository;
  if (task.agentId !== agent.id) throw new Error('Execution agent is not assigned to this task.');

  const candidateGrants = await prisma.capabilityGrant.findMany({
    where: {
      agentId: agent.id,
      capability: 'branch.create',
      effect: 'ALLOW',
      OR: [{ resource: '*' }, { resource: repo.id }, { resource: `${repo.owner}/${repo.name}` }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });
  const grant = candidateGrants.find((item) => grantMatchesTaskScope(item.conditions, task.id, execution.id));
  if (!grant) throw new Error('Policy denied branch.create: no active task-scoped ALLOW capability grant for this execution.');

  const installation = await createInstallationToken();
  const token = installation.token;
  const fullName = `${repo.owner}/${repo.name}`;
  const base = await github<{ object: { sha: string } }>(
    `${GITHUB_API}/repos/${repo.owner}/${repo.name}/git/ref/heads/${encodeURIComponent(repo.defaultBranch)}`,
    token,
  );

  const safeExecution = execution.id.replace(/[^a-zA-Z0-9-]/g, '').slice(-12).toLowerCase();
  const branch = `gitagent/${safeExecution || Date.now()}`;
  await github(
    `${GITHUB_API}/repos/${repo.owner}/${repo.name}/git/refs`,
    token,
    { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) },
  );

  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId: execution.id,
      eventType: 'github.branch.created',
      actorType: 'agent',
      actorId: agent.id,
      payload: {
        repositoryId: repo.id,
        repository: fullName,
        branch,
        baseBranch: repo.defaultBranch,
        baseSha: base.object.sha,
        installationTokenExpiresAt: installation.expires_at,
        capabilityGrantId: grant.id,
        policyVersion: '2026-09-16.1',
        reasonCode: 'policy.branch_create_allowed',
        severity: 'info',
        result: 'success',
        metadata: { taskScoped: true, taskId: task.id, executionId: execution.id, explanation: 'GitAgent authorized the implementation agent to create a branch only for this sponsored task and execution.' },
      },
    },
  });

  return { branch, baseBranch: repo.defaultBranch, baseSha: base.object.sha, repository: fullName };
}
