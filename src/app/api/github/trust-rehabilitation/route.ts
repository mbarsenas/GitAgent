import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAgentTrustState, recordCleanExecution, restrictAgent } from '@/lib/github/trust-lifecycle';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.agentId) return NextResponse.json({ ok: false, error: 'agentId is required.' }, { status: 400 });

    const agent = await prisma.agent.findUnique({ where: { id: body.agentId } });
    if (!agent) return NextResponse.json({ ok: false, error: 'Agent not found.' }, { status: 404 });

    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    const repository = agent.repositoryId ? await prisma.repository.findUnique({ where: { id: agent.repositoryId } }) : null;
    if (!user || !repository) throw new Error('Sponsor user or agent repository not found.');

    const restriction = await restrictAgent(agent.id, null, null, 'policy.rehabilitation_test');
    const runs = [];

    for (let i = 1; i <= 5; i += 1) {
      const task = await prisma.task.create({ data: { title: `Trust rehabilitation clean run ${i}`, goal: 'Verify restricted-agent automatic rehabilitation threshold.', status: 'SUCCEEDED', repositoryId: repository.id, agentId: agent.id, initiatorId: user.id, requiresHumanApproval: true } });
      const execution = await prisma.execution.create({ data: { taskId: task.id, agentId: agent.id, status: 'SUCCEEDED', providerKey: agent.providerKey, model: agent.model, startedAt: new Date(), finishedAt: new Date() } });
      await prisma.auditEvent.create({ data: { taskId: task.id, executionId: execution.id, eventType: 'execution.completed', actorType: 'agent', actorId: agent.id, payload: { policyVersion: '2026-09-16.1', result: 'success', trustRehabilitationTest: true, cleanRunOrdinal: i } } });
      const trust = await recordCleanExecution(agent.id, task.id, execution.id);
      runs.push({ ordinal: i, taskId: task.id, executionId: execution.id, ...trust });
    }

    const finalTrustState = await getAgentTrustState(agent.id);
    return NextResponse.json({ ok: true, agentId: agent.id, restriction, runs, finalTrustState, rehabilitated: finalTrustState === 'TRUSTED' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
