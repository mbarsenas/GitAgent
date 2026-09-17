import { prisma } from '@/lib/db/prisma';
import { createGovernedBranch } from './governed-branch';
import { createGovernedChange } from './governed-change';
import { attemptPullRequestApproval } from './review-boundary';
import { evaluateProtectedBranchWrite, evaluateWorkspaceWrite } from './negative-controls';

const IMPLEMENTATION_CAPABILITIES = ['branch.create', 'branch.write', 'pr.create'];

export async function runGovernedDemo() {
  const repository = await prisma.repository.findFirst({ where: { owner: 'mbarsenas', name: 'GitAgent' }, orderBy: { createdAt: 'asc' } });
  if (!repository) throw new Error('GitAgent repository not found.');
  const implementationAgent = await prisma.agent.findFirst({ where: { repositoryId: repository.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  if (!implementationAgent) throw new Error('Active implementation agent not found for GitAgent repository.');
  const reviewAgent = await prisma.agent.findFirst({ where: { status: 'ACTIVE', grants: { some: { capability: 'review.approve', effect: 'ALLOW' } } }, orderBy: { createdAt: 'asc' } });
  if (!reviewAgent) throw new Error('Active review agent with review.approve grant not found.');
  const initiator = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!initiator) throw new Error('Sponsor user not found.');

  const task = await prisma.task.create({ data: { title: `Governed vertical slice ${new Date().toISOString()}`, goal: 'Prove implementation, independent review, adversarial controls, and execution-scoped capability enforcement end to end.', status: 'RUNNING', repositoryId: repository.id, agentId: implementationAgent.id, initiatorId: initiator.id, requiresHumanApproval: false } });
  const execution = await prisma.execution.create({ data: { taskId: task.id, agentId: implementationAgent.id, status: 'RUNNING', providerKey: implementationAgent.providerKey, model: implementationAgent.model, startedAt: new Date() } });

  const executionGrantIds: string[] = [];
  for (const capability of IMPLEMENTATION_CAPABILITIES) {
    const grant = await prisma.capabilityGrant.create({ data: { agentId: implementationAgent.id, capability, resource: repository.id, effect: 'ALLOW', conditions: { scope: 'sponsored-execution', taskId: task.id, executionId: execution.id, repository: `${repository.owner}/${repository.name}` } } });
    executionGrantIds.push(grant.id);
  }

  await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'sponsorship.granted', actorType: 'human', actorId: initiator.id, payload: { policyVersion: '2026-09-16.1', repository: `${repository.owner}/${repository.name}`, implementationAgentId: implementationAgent.id, reviewAgentId: reviewAgent.id, capabilityGrantIds: executionGrantIds, capabilities: IMPLEMENTATION_CAPABILITIES, scope: { taskId: task.id, executionId: execution.id } } } });
  await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'execution.started', actorType: 'user', actorId: initiator.id, payload: { policyVersion: '2026-09-16.1', repository: `${repository.owner}/${repository.name}`, implementationAgentId: implementationAgent.id, reviewAgentId: reviewAgent.id } } });

  try {
    const protectedBranch = await evaluateProtectedBranchWrite(execution.id, repository.defaultBranch);
    const crossWorkspace = await evaluateWorkspaceWrite(execution.id, `foreign-${execution.id}`);
    if (protectedBranch.allowed || crossWorkspace.allowed) throw new Error('Adversarial policy control failed closed-loop verification.');

    const branch = await createGovernedBranch(execution.id);
    const change = await createGovernedChange(execution.id, branch.branch);
    const selfApproval = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, implementationAgent.id);
    const independentReview = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, reviewAgent.id);
    const independentApproval = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, reviewAgent.id);
    const controlsPassed = selfApproval.allowed === false && protectedBranch.allowed === false && crossWorkspace.allowed === false && independentReview.reviewGitHubApp === 'gitagent-review' && independentApproval.approvalSubmitted === true;
    if (!controlsPassed) throw new Error('Governed vertical slice did not satisfy all required policy controls.');

    await prisma.execution.update({ where: { id: execution.id }, data: { status: 'SUCCEEDED', finishedAt: new Date() } });
    await prisma.task.update({ where: { id: task.id }, data: { status: 'SUCCEEDED' } });
    await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'execution.completed', actorType: 'system', actorId: 'gitagent', payload: { policyVersion: '2026-09-16.1', result: 'success', pullRequestNumber: change.pullRequestNumber, controlsPassed: true, taskScopedCapabilities: true, capabilityGrantIds: executionGrantIds, selfApprovalDenied: true, protectedBranchWriteDenied: true, crossWorkspaceWriteDenied: true, independentReviewPrincipal: independentReview.reviewGitHubApp, independentApprovalSubmitted: true } } });
    return { taskId: task.id, executionId: execution.id, repository: branch.repository, branch: branch.branch, pullRequestNumber: change.pullRequestNumber, pullRequestUrl: change.pullRequestUrl, controlsPassed, taskScopedCapabilities: true, executionGrantIds, protectedBranch, crossWorkspace, selfApproval, independentReview, independentApproval };
  } catch (error) {
    await prisma.execution.update({ where: { id: execution.id }, data: { status: 'FAILED', finishedAt: new Date() } });
    await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED' } });
    await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'execution.failed', actorType: 'system', actorId: 'gitagent', payload: { policyVersion: '2026-09-16.1', error: error instanceof Error ? error.message : String(error), capabilityGrantIds: executionGrantIds } } });
    throw error;
  }
}
