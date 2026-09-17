import { prisma } from '@/lib/db/prisma';
import { createInstallationToken } from './auth';

const API = 'https://api.github.com';
const VERSION = '2022-11-28';

export async function requestHumanMergeApproval(executionId: string, pullRequestNumber: number) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId }, include: { task: { include: { repository: true, approvals: true } } } });
  if (!execution) throw new Error('Execution not found.');
  const existing = execution.task.approvals.find((a) => a.action === `pr.merge:${pullRequestNumber}` && (a.status === 'PENDING' || a.status === 'APPROVED'));
  if (existing) return existing;
  const approval = await prisma.approval.create({ data: { taskId: execution.taskId, action: `pr.merge:${pullRequestNumber}`, status: 'PENDING' } });
  await prisma.task.update({ where: { id: execution.taskId }, data: { status: 'WAITING_APPROVAL', requiresHumanApproval: true } });
  await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId, eventType: 'merge.approval.requested', actorType: 'system', actorId: 'gitagent', payload: { approvalId: approval.id, pullRequestNumber, reasonCode: 'policy.human_merge_approval_required', policyVersion: '2026-09-16.1' } } });
  return approval;
}

export async function attemptMergeAsAgent(executionId: string, pullRequestNumber: number, actorAgentId: string) {
  const execution = await prisma.execution.findUnique({ where: { id: executionId } });
  if (!execution) throw new Error('Execution not found.');
  const reasonCode = actorAgentId === execution.agentId ? 'policy.implementation_agent_merge_denied' : 'policy.agent_merge_denied';
  await prisma.auditEvent.create({ data: { taskId: execution.taskId, executionId, eventType: 'policy.merge.denied', actorType: 'agent', actorId: actorAgentId, payload: { pullRequestNumber, decision: 'DENY', reasonCode, githubRequestSent: false, policyVersion: '2026-09-16.1' } } });
  return { allowed: false as const, decision: 'DENY', reasonCode, githubRequestSent: false };
}

export async function executeHumanApprovedMerge(approvalId: string, humanActorId: string, reason?: string) {
  const approval = await prisma.approval.findUnique({ where: { id: approvalId }, include: { task: { include: { repository: true, executions: { orderBy: { createdAt: 'desc' }, take: 1 } } } } });
  if (!approval || !approval.action.startsWith('pr.merge:')) throw new Error('Merge approval not found.');
  if (approval.status !== 'PENDING') throw new Error(`Merge approval already decided: ${approval.status}.`);
  const human = await prisma.user.findUnique({ where: { id: humanActorId } });
  if (!human) throw new Error('Human actor not found.');
  const execution = approval.task.executions[0];
  if (!execution) throw new Error('Execution not found for merge approval.');
  const pr = Number(approval.action.split(':')[1]);
  const independentApproval = await prisma.auditEvent.findFirst({ where: { executionId: execution.id, eventType: 'github.review.approved' } });
  if (!independentApproval) throw new Error('Independent approval is required before merge.');
  const token = await createInstallationToken();
  const repo = approval.task.repository;
  const response = await fetch(`${API}/repos/${repo.owner}/${repo.name}/pulls/${pr}/merge`, { method: 'PUT', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.token}`, 'X-GitHub-Api-Version': VERSION, 'User-Agent': 'GitAgent-Control', 'Content-Type': 'application/json' }, body: JSON.stringify({ merge_method: 'squash' }) });
  const result = await response.json() as { merged?: boolean; message?: string; sha?: string };
  if (!response.ok || !result.merged) throw new Error(`GitHub merge failed: ${result.message ?? response.status}`);
  await prisma.$transaction([
    prisma.approval.update({ where: { id: approval.id }, data: { status: 'APPROVED', actorId: human.id, decidedAt: new Date(), reason: reason ?? null } }),
    prisma.task.update({ where: { id: approval.taskId }, data: { status: 'SUCCEEDED' } }),
    prisma.auditEvent.create({ data: { taskId: approval.taskId, executionId: execution.id, eventType: 'github.pr.merged', actorType: 'human', actorId: human.id, payload: { approvalId, pullRequestNumber: pr, mergeSha: result.sha ?? null, approvedByUserId: human.id, githubRequestSent: true, policyVersion: '2026-09-16.1' } } }),
  ]);
  return { allowed: true as const, merged: true, pullRequestNumber: pr, mergeSha: result.sha ?? null, approvalId, approvedByUserId: human.id };
}
