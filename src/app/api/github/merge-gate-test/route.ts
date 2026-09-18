import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { attemptMergeAsAgent, requestHumanMergeApproval } from '@/lib/github/merge-boundary';

export async function POST(request: Request) {
  try {
    const { executionId, pullRequestNumber } = await request.json();
    if (!executionId || !pullRequestNumber) return NextResponse.json({ ok: false, error: 'executionId and pullRequestNumber are required.' }, { status: 400 });
    const execution = await prisma.execution.findUnique({ where: { id: executionId } });
    if (!execution) return NextResponse.json({ ok: false, error: 'Execution not found.' }, { status: 404 });
    const reviewer = await prisma.agent.findFirst({ where: { id: { not: execution.agentId }, status: 'ACTIVE', grants: { some: { capability: 'review.approve', effect: 'ALLOW' } } } });
    if (!reviewer) throw new Error('Review agent not found.');
    const implementationMerge = await attemptMergeAsAgent(executionId, pullRequestNumber, execution.agentId);
    const reviewerMerge = await attemptMergeAsAgent(executionId, pullRequestNumber, reviewer.id);
    const approval = await requestHumanMergeApproval(executionId, pullRequestNumber);
    const passed = implementationMerge.allowed === false && implementationMerge.githubRequestSent === false && implementationMerge.reasonCode === 'policy.implementation_agent_merge_denied' && reviewerMerge.allowed === false && reviewerMerge.githubRequestSent === false && reviewerMerge.reasonCode === 'policy.agent_merge_denied' && approval.status === 'PENDING';
    return NextResponse.json({ ok: true, passed, executionId, pullRequestNumber, implementationMerge, reviewerMerge, humanMergeGate: { required: true, approvalId: approval.id, status: approval.status, reasonCode: 'policy.human_merge_approval_required' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
