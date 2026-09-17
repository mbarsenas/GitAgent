import { prisma } from '@/lib/db/prisma';
import { createGovernedBranch } from '@/lib/github/governed-branch';
import { createInstallationToken } from '@/lib/github/auth';
import { authorizeWorkspaceWrite } from '@/lib/governance/workspace';
import { grantMatchesTaskScope } from '@/lib/policy/task-scope';
import { getAgentTrustState } from '@/lib/github/trust-lifecycle';
import { generateCodingPlan, isImplementationLlmConfigured } from './llm';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';
const POLICY_VERSION = '2026-09-16.1';

type RepoFile = { path: string; sha: string; size: number; type: 'blob' | 'tree' };

type AgentPlan = {
  summary: string;
  files: Array<{ path: string; reason: string }>;
  proposedChanges: Array<{ path: string; content: string; message: string }>;
};

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
  return response.json() as Promise<T>;
}

async function requireGrant(
  agentId: string,
  capability: string,
  repositoryId: string,
  fullName: string,
  taskId: string,
  executionId: string,
) {
  const grants = await prisma.capabilityGrant.findMany({
    where: {
      agentId,
      capability,
      effect: 'ALLOW',
      OR: [{ resource: '*' }, { resource: repositoryId }, { resource: fullName }, { resource: `task:${taskId}` }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });

  const grant = grants.find(
    (item) => grantMatchesTaskScope(item.conditions, taskId, executionId) || item.resource === `task:${taskId}`,
  );
  if (!grant) throw new Error(`Policy denied ${capability}: no active task-scoped ALLOW capability grant.`);
  return grant;
}

function pickCandidateFiles(goal: string, files: RepoFile[]) {
  const words = goal
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((word) => word.length > 2);

  const ignored = new Set(['node_modules', '.next', 'dist', 'build', '.git', 'coverage']);
  return files
    .filter((file) => file.type === 'blob' && file.size < 150_000)
    .filter((file) => !file.path.split('/').some((part) => ignored.has(part)))
    .map((file) => ({
      ...file,
      score:
        words.reduce((score, word) => score + (file.path.toLowerCase().includes(word) ? 3 : 0), 0) +
        (/(src|app|lib|components|pages|api)\//.test(file.path) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 12);
}

function validatePlan(plan: AgentPlan, inspected: Array<{ path: string; content: string }>) {
  const inspectedPaths = new Set(inspected.map((file) => file.path));
  const invalid = plan.proposedChanges.filter((change) => !inspectedPaths.has(change.path));
  if (invalid.length > 0) {
    throw new Error(
      `Generated plan attempted to modify files outside inspected repository context: ${invalid
        .map((item) => item.path)
        .join(', ')}`,
    );
  }
}

export async function runRepositoryAgent(executionId: string) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true, approvals: true } }, agent: true, workspace: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const { task, agent } = execution;
  const repo = task.repository;
  const fullName = `${repo.owner}/${repo.name}`;
  if (task.agentId !== agent.id) throw new Error('Execution agent is not assigned to this task.');

  const trust = await getAgentTrustState(agent.id);
  if (trust === 'QUARANTINED') throw new Error('Policy denied execution: agent is QUARANTINED.');
  if (
    trust === 'RESTRICTED' &&
    !task.approvals.some(
      (approval) =>
        approval.action === 'restricted.execute' &&
        approval.status === 'APPROVED' &&
        approval.executionId === execution.id,
    )
  ) {
    throw new Error('Policy denied execution: RESTRICTED agent lacks execution-bound human approval.');
  }

  await prisma.execution.update({
    where: { id: execution.id },
    data: { status: 'RUNNING', startedAt: execution.startedAt ?? new Date() },
  });
  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId,
      eventType: 'agent.execution.started',
      actorType: 'agent',
      actorId: agent.id,
      payload: { goal: task.goal, repository: fullName, policyVersion: POLICY_VERSION },
    },
  });

  const readGrant = await requireGrant(agent.id, 'repo.read', repo.id, fullName, task.id, execution.id);
  const installation = await createInstallationToken();
  const tree = await github<{ tree: RepoFile[] }>(
    `${API}/repos/${repo.owner}/${repo.name}/git/trees/${encodeURIComponent(repo.defaultBranch)}?recursive=1`,
    installation.token,
  );

  const candidates = pickCandidateFiles(task.goal, tree.tree);
  const inspected: Array<{ path: string; content: string }> = [];
  for (const file of candidates.slice(0, 8)) {
    try {
      const result = await github<{ content?: string; encoding?: string }>(
        `${API}/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(file.path)}?ref=${encodeURIComponent(repo.defaultBranch)}`,
        installation.token,
      );
      if (result.encoding === 'base64' && result.content) {
        inspected.push({
          path: file.path,
          content: Buffer.from(result.content.replace(/\n/g, ''), 'base64').toString('utf8'),
        });
      }
    } catch {
      // Skip unreadable or unsupported files and continue gathering context.
    }
  }

  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId,
      eventType: 'agent.repository.inspected',
      actorType: 'agent',
      actorId: agent.id,
      payload: {
        repository: fullName,
        defaultBranch: repo.defaultBranch,
        capabilityGrantId: readGrant.id,
        candidateFiles: candidates.map((file) => file.path),
        inspectedFiles: inspected.map((file) => file.path),
        policyVersion: POLICY_VERSION,
      },
    },
  });

  if (!isImplementationLlmConfigured()) {
    await prisma.execution.update({ where: { id: execution.id }, data: { status: 'WAITING_APPROVAL' } });
    await prisma.task.update({ where: { id: task.id }, data: { status: 'WAITING_APPROVAL' } });
    await prisma.auditEvent.create({
      data: {
        taskId: task.id,
        executionId,
        eventType: 'agent.change_generation.blocked',
        actorType: 'system',
        actorId: 'gitagent',
        payload: {
          reasonCode: 'agent.llm_provider_not_configured',
          message:
            'Repository inspection completed, but OPENAI_API_KEY is not configured for implementation generation.',
          policyVersion: POLICY_VERSION,
        },
      },
    });
    return {
      executionId,
      repository: fullName,
      inspectedFiles: inspected.map((file) => file.path),
      status: 'WAITING_APPROVAL' as const,
      blocked: true,
      reasonCode: 'agent.llm_provider_not_configured',
    };
  }

  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId,
      eventType: 'agent.implementation_generation.started',
      actorType: 'agent',
      actorId: agent.id,
      payload: {
        repository: fullName,
        inspectedFiles: inspected.map((file) => file.path),
        policyVersion: POLICY_VERSION,
      },
    },
  });

  const plan = await generateCodingPlan({
    goal: task.goal,
    repository: fullName,
    defaultBranch: repo.defaultBranch,
    files: inspected,
  });
  validatePlan(plan, inspected);

  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId,
      eventType: 'agent.plan.created',
      actorType: 'agent',
      actorId: agent.id,
      payload: {
        summary: plan.summary,
        files: plan.files,
        proposedChangePaths: plan.proposedChanges.map((change) => change.path),
        policyVersion: POLICY_VERSION,
      },
    },
  });

  if (plan.proposedChanges.length === 0) {
    await prisma.execution.update({ where: { id: execution.id }, data: { status: 'FAILED', finishedAt: new Date() } });
    await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED' } });
    throw new Error('Implementation model produced no code changes for the requested task.');
  }

  const branch = await createGovernedBranch(executionId);
  const refreshedExecution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { workspace: true },
  });
  if (!refreshedExecution?.workspace) throw new Error('Execution workspace was not provisioned with governed branch.');

  const workspaceDecision = await authorizeWorkspaceWrite(
    executionId,
    refreshedExecution.workspace.workspaceKey,
    agent.id,
  );
  if (!workspaceDecision.allowed) {
    throw new Error('Policy denied branch.write: execution workspace ownership failed.');
  }

  const writeGrant = await requireGrant(agent.id, 'branch.write', repo.id, fullName, task.id, execution.id);

  for (const change of plan.proposedChanges) {
    const current = await github<{ sha: string }>(
      `${API}/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(change.path)}?ref=${encodeURIComponent(branch.branch)}`,
      installation.token,
    );

    await github(
      `${API}/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(change.path)}`,
      installation.token,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: change.message,
          content: Buffer.from(change.content).toString('base64'),
          sha: current.sha,
          branch: branch.branch,
        }),
      },
    );
  }

  await prisma.auditEvent.create({
    data: {
      taskId: task.id,
      executionId,
      eventType: 'agent.changes.applied',
      actorType: 'agent',
      actorId: agent.id,
      payload: {
        branch: branch.branch,
        capabilityGrantId: writeGrant.id,
        files: plan.proposedChanges.map((change) => change.path),
        policyVersion: POLICY_VERSION,
      },
    },
  });

  return {
    executionId,
    repository: fullName,
    branch: branch.branch,
    plan,
    status: 'RUNNING' as const,
    blocked: false,
  };
}
