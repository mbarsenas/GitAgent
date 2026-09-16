import { NextResponse } from 'next/server';
import { performGovernedTaskAction } from '@/lib/governance/task-actions';

export async function POST() {
  const result = await performGovernedTaskAction({
    role: 'implementation-agent',
    capability: 'review.approve',
    actorId: 'agent-impl-demo',
    targetOwnerAgentId: 'agent-impl-demo',
    taskId: 'demo-task',
    repositoryId: 'demo-repository',
    executionId: 'demo-execution',
    policyVersion: '2026-09-16.1',
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}
