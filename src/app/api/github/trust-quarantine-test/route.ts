import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState, recordCleanExecution, recordSubstantiveViolation } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const { agentId } = await request.json();
    if (!agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { repository: true } });
    if (!agent?.repository) throw new Error('Agent repository not found.');
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!user) throw new Error('Sponsor user not found.');
    const before = await getAgentTrustState(agentId);
    const task = await prisma.task.create({ data: { title: `Quarantine boundary test ${new Date().toISOString()}`, goal: 'Verify substantive violations quarantine an agent and clean runs cannot self-rehabilitate it.', repositoryId: agent.repository.id, agentId, initiatorId: user.id, status: 'RUNNING', requiresHumanApproval: true } });
    const execution = await prisma.execution.create({ data: { taskId: task.id, agentId, providerKey: agent.providerKey, model: agent.model, status: 'FAILED', startedAt: new Date(), finishedAt: new Date() } });
    const quarantine = await recordSubstantiveViolation(agentId, task.id, execution.id, 'policy.test_substantive_violation');
    const cleanAttempt = await recordCleanExecution(agentId, task.id, execution.id);
    const after = await getAgentTrustState(agentId);
    const passed = quarantine.trustState === 'QUARANTINED' && cleanAttempt.trustState === 'QUARANTINED' && cleanAttempt.rehabilitated === false && after === 'QUARANTINED';
    await prisma.task.update({ where: { id: task.id }, data: { status: passed ? 'SUCCEEDED' : 'FAILED' } });
    return NextResponse.json({ ok: true, passed, before, quarantine, cleanAttempt, finalTrustState: after, executionGateExpected: 'DENY', requiresHumanReview: true, note: 'This intentionally leaves the agent QUARANTINED so the execution gate can be verified next.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
