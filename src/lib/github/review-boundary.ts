import { prisma } from '@/lib/db/prisma';

export async function attemptPullRequestApproval(executionId: string, pullRequestNumber: number, actorAgentId: string) {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { task: { include: { repository: true } }, agent: true },
  });
  if (!execution) throw new Error('Execution not found.');

  const repository = `${execution.task.repository.owner}/${execution.task.repository.name}`;

  if (actorAgentId === execution.agentId) {
    await prisma.auditEvent.create({
      data: {
        taskId: execution.taskId,
        executionId: execution.id,
        eventType: 'policy.review.denied',
        actorType: 'agent',
        actorId: actorAgentId,
        payload: {
          repository,
          pullRequestNumber,
          requestedCapability: 'review.approve',
          decision: 'DENY',
          policyVersion: '2026-09-16.1',
          reasonCode: 'policy.self_approval_denied',
          severity: 'high',
          implementationAgentId: execution.agentId,
          metadata: {
            explanation: 'GitAgent denied the approval because the requesting identity is the same implementation agent that produced the governed change.',
            githubRequestSent: false,
          },
        },
      },
    });

    return {
      allowed: false as const,
      decision: 'DENY',
      reasonCode: 'policy.self_approval_denied',
      githubRequestSent: false,
      message: 'Implementation agents cannot approve their own governed changes.',
    };
  }

  const grant = await prisma.capabilityGrant.findFirst({
    where: {
      agentId: actorAgentId,
      capability: 'review.approve',
      effect: 'ALLOW',
      OR: [
        { resource: '*' },
        { resource: execution.task.repository.id },
        { resource: repository },
      ],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
    },
  });

  if (!grant) {
    await prisma.auditEvent.create({
      data: {
        taskId: execution.taskId,
        executionId: execution.id,
        eventType: 'policy.review.denied',
        actorType: 'agent',
        actorId: actorAgentId,
        payload: {
          repository,
          pullRequestNumber,
          requestedCapability: 'review.approve',
          decision: 'DENY',
          policyVersion: '2026-09-16.1',
          reasonCode: 'policy.capability_not_granted',
          severity: 'high',
          metadata: { explanation: 'The requesting review identity has no active review.approve grant.', githubRequestSent: false },
        },
      },
    });
    return { allowed: false as const, decision: 'DENY', reasonCode: 'policy.capability_not_granted', githubRequestSent: false };
  }

  return { allowed: true as const, decision: 'ALLOW', capabilityGrantId: grant.id };
}
