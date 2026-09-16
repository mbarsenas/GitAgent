import { prisma } from '@/lib/db/prisma';

export async function evaluateProtectedBranchWrite(executionId: string, targetBranch: string) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId }, include: { task: { include: { repository: true } } } });
  if (!execution) throw new Error('Execution not found.');
  const repo = execution.task.repository;
  const protectedTarget = targetBranch === repo.defaultBranch;
  if (protectedTarget) {
    await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId, eventType: 'policy.branch_write.denied', actorType: 'agent', actorId: execution.agentId, payload: { repository: `${repo.owner}/${repo.name}`, targetBranch, decision: 'DENY', reasonCode: 'policy.protected_branch_write_denied', githubRequestSent: false, policyVersion: '2026-09-16.1', severity: 'high' } } });
    return { allowed: false as const, decision: 'DENY', reasonCode: 'policy.protected_branch_write_denied', githubRequestSent: false };
  }
  return { allowed: true as const, decision: 'ALLOW', reasonCode: 'policy.branch_target_allowed', githubRequestSent: false };
}

export async function evaluateWorkspaceWrite(executionId: string, requestedWorkspaceExecutionId: string) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution) throw new Error('Execution not found.');
  if (requestedWorkspaceExecutionId !== execution.id) {
    await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId, eventType: 'policy.workspace_write.denied', actorType: 'agent', actorId: execution.agentId, payload: { executionWorkspace: execution.id, requestedWorkspace: requestedWorkspaceExecutionId, decision: 'DENY', reasonCode: 'policy.cross_workspace_write_denied', writeAttempted: false, policyVersion: '2026-09-16.1', severity: 'high' } } });
    return { allowed: false as const, decision: 'DENY', reasonCode: 'policy.cross_workspace_write_denied', writeAttempted: false };
  }
  return { allowed: true as const, decision: 'ALLOW', reasonCode: 'policy.workspace_write_allowed', writeAttempted: false };
}
