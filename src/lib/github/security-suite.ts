import { prisma } from '@/lib/db/prisma';
import { attemptPullRequestApproval } from './review-boundary';
import { attemptMergeAsAgent } from './merge-boundary';
import { evaluateProtectedBranchWrite, evaluateWorkspaceWrite } from './negative-controls';
import { reviewMatchesHead } from './review-verdict';

// Exercise denial paths only. Positive evidence must come from the actual review.
export async function verifyExecutionBoundaries(executionId: string, pullRequestNumber: number) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId }, include: { task: { include: { repository: true, approvals: true } }, workspace: true } });
  if (!execution?.workspace) throw new Error('Execution workspace is required.');
  const events = await prisma.auditEvent.findMany({ where: { executionId }, orderBy: { createdAt: 'desc' } });
  const exact = (type: string) => events.find(e => e.eventType === type && (e.payload as Record<string, unknown>).pullRequestNumber === pullRequestNumber);
  const approval = exact('github.review.approved');
  const p = (approval?.payload ?? {}) as Record<string, unknown>;
  const reviewerId = typeof p.reviewerAgentId === 'string' ? p.reviewerAgentId : '';
  if (!exact('github.pr.created') || !reviewerId || reviewerId === execution.agentId || p.implementationAgentId !== execution.agentId || approval?.actorId !== reviewerId) {
    throw new Error('Execution-bound independent review evidence is required.');
  }
  const self = await attemptPullRequestApproval(executionId, pullRequestNumber, execution.agentId);
  const branch = await evaluateProtectedBranchWrite(executionId, execution.task.repository.defaultBranch);
  const workspace = await evaluateWorkspaceWrite(executionId, `${executionId}-foreign`);
  const implementationMerge = await attemptMergeAsAgent(executionId, pullRequestNumber, execution.agentId);
  const reviewerMerge = await attemptMergeAsAgent(executionId, pullRequestNumber, reviewerId);
  const review = exact('github.review.created');
  const mergeApproval = execution.task.approvals.find(a => a.executionId === executionId && a.resourceType === 'github.pull_request' && a.resourceId === String(pullRequestNumber) && a.action === `pr.merge:${pullRequestNumber}` && ['PENDING', 'APPROVED'].includes(a.status));
  const checks = [
    { name: 'self_approval_denied', passed: !self.allowed && self.reasonCode === 'policy.self_approval_denied' && !self.githubRequestSent },
    { name: 'protected_branch_write_denied', passed: !branch.allowed && !branch.githubRequestSent },
    { name: 'cross_workspace_write_denied', passed: !workspace.allowed && !workspace.writeAttempted },
    { name: 'implementation_merge_denied', passed: !implementationMerge.allowed && !implementationMerge.githubRequestSent },
    { name: 'reviewer_merge_denied', passed: !reviewerMerge.allowed && !reviewerMerge.githubRequestSent },
    { name: 'independent_review_inspected_commit', passed: !!review && typeof p.headSha === 'string' && reviewMatchesHead(review.payload, p.headSha) },
    { name: 'independent_approval_bound_to_commit', passed: typeof p.headSha === 'string' && reviewMatchesHead(p, p.headSha) },
    { name: 'human_merge_gate_bound', passed: !!mergeApproval },
    { name: 'workspace_owned_by_implementation', passed: execution.workspace.ownerAgentId === execution.agentId && execution.workspace.repositoryId === execution.task.repositoryId },
  ];
  const passed = checks.every(c => c.passed);
  await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId, eventType: 'security.suite.completed', actorType: 'system', actorId: 'gitagent', payload: { passed, totalChecks: checks.length, failedChecks: checks.filter(c => !c.passed).map(c => c.name), pullRequestNumber, headSha: typeof p.headSha === 'string' ? p.headSha : null, policyVersion: '2026-09-16.1' } } });
  return { passed, checks, executionId, pullRequestNumber };
}
