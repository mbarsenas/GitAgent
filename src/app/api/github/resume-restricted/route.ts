import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState, recordCleanExecution } from '@/lib/github/trust-lifecycle';
import { createGovernedBranch } from '@/lib/github/governed-branch';
import { createGovernedChange } from '@/lib/github/governed-change';
import { attemptPullRequestApproval } from '@/lib/github/review-boundary';

const CAPABILITIES = ['branch.create', 'branch.write', 'pr.create'];

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    if (!taskId) return NextResponse.json({ ok: false, error: 'taskId is required.' }, { status: 400 });
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { repository: true, agent: true, approvals: true, executions: true } });
    if (!task?.agent) return NextResponse.json({ ok: false, error: 'Task or assigned agent not found.' }, { status: 404 });
    if (task.status !== 'QUEUED') return NextResponse.json({ ok: false, error: `Task must be QUEUED after approval; current status is ${task.status}.` }, { status: 409 });
    const approval = task.approvals.find((a) => a.action === 'restricted.execute' && a.status === 'APPROVED');
    if (!approval?.actorId) return NextResponse.json({ ok: false, error: 'Approved human restricted.execute approval is required.' }, { status: 403 });
    if (task.executions.length > 0) return NextResponse.json({ ok: false, error: 'Task already has an execution; refusing duplicate resume.' }, { status: 409 });
    const trustState = await getAgentTrustState(task.agent.id);
    if (trustState === 'QUARANTINED') return NextResponse.json({ ok: false, error: 'Agent became QUARANTINED after approval; execution denied.' }, { status: 403 });
    if (trustState !== 'RESTRICTED') return NextResponse.json({ ok: false, error: `Approved restricted task cannot resume from trust state ${trustState}.` }, { status: 409 });
    const reviewer = await prisma.agent.findFirst({ where: { status: 'ACTIVE', grants: { some: { capability: 'review.approve', effect: 'ALLOW' } } }, orderBy: { createdAt: 'asc' } });
    if (!reviewer) throw new Error('Independent review agent not found.');
    const execution = await prisma.execution.create({ data: { taskId: task.id, agentId: task.agent.id, status: 'RUNNING', providerKey: task.agent.providerKey, model: task.agent.model, startedAt: new Date() } });
    await prisma.task.update({ where: { id: task.id }, data: { status: 'RUNNING' } });
    const grantIds: string[] = [];
    for (const capability of CAPABILITIES) {
      const grant = await prisma.capabilityGrant.create({ data: { agentId: task.agent.id, capability, resource: task.repository.id, effect: 'ALLOW', conditions: { scope: 'human-approved-restricted-execution', taskId: task.id, executionId: execution.id, approvalId: approval.id, approvedByUserId: approval.actorId, trustStateAtGrant: trustState } } });
      grantIds.push(grant.id);
    }
    await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'restricted.execution.resumed', actorType: 'human', actorId: approval.actorId, payload: { approvalId: approval.id, capabilityGrantIds: grantIds, policyVersion: '2026-09-16.1' } } });
    try {
      const branch = await createGovernedBranch(execution.id);
      const change = await createGovernedChange(execution.id, branch.branch, []);
      const selfApproval = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, task.agent.id);
      const independentReview = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, reviewer.id);
      const independentApproval = await attemptPullRequestApproval(execution.id, change.pullRequestNumber, reviewer.id);
      const passed = !selfApproval.allowed && independentReview.reviewGitHubApp === 'gitagent-review' && independentApproval.approvalSubmitted === true;
      if (!passed) throw new Error('Resumed restricted execution failed governance controls.');
      await prisma.execution.update({ where: { id: execution.id }, data: { status: 'SUCCEEDED', finishedAt: new Date() } });
      await prisma.task.update({ where: { id: task.id }, data: { status: 'SUCCEEDED' } });
      await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'execution.completed', actorType: 'agent', actorId: task.agent.id, payload: { result: 'success', approvalId: approval.id, pullRequestNumber: change.pullRequestNumber, policyVersion: '2026-09-16.1' } } });
      const trustAfterExecution = await recordCleanExecution(task.agent.id, task.id, execution.id);
      return NextResponse.json({ ok: true, resumedExistingTask: true, taskId: task.id, approvalId: approval.id, executionId: execution.id, approvedByUserId: approval.actorId, trustStateAtStart: trustState, executionGrantIds: grantIds, pullRequestNumber: change.pullRequestNumber, pullRequestUrl: change.pullRequestUrl, controlsPassed: passed, trustAfterExecution });
    } catch (error) {
      await prisma.execution.update({ where: { id: execution.id }, data: { status: 'FAILED', finishedAt: new Date() } });
      await prisma.task.update({ where: { id: task.id }, data: { status: 'FAILED' } });
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
