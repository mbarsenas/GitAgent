import { prisma } from '@/lib/db/prisma';
import { PrismaAuditSink } from '@/lib/governance/prisma-audit-sink';

export type CreateGovernedTaskInput = {
  repositoryId: string;
  agentId: string;
  initiatorId: string;
  title: string;
  goal: string;
  maxCostUsd?: number;
  maxTokens?: number;
  requiresHumanApproval?: boolean;
  capabilities: string[];
  policyVersion: string;
  expiresAt?: Date;
};

export async function createGovernedTask(input: CreateGovernedTaskInput) {
  const audit = new PrismaAuditSink();

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: input.title,
        goal: input.goal,
        repositoryId: input.repositoryId,
        agentId: input.agentId,
        initiatorId: input.initiatorId,
        maxCostUsd: input.maxCostUsd,
        maxTokens: input.maxTokens,
        requiresHumanApproval: input.requiresHumanApproval ?? true,
      },
    });

    await tx.capabilityGrant.createMany({
      data: input.capabilities.map((capability) => ({
        agentId: input.agentId,
        capability,
        resource: `task:${task.id}`,
        effect: 'ALLOW',
        expiresAt: input.expiresAt,
        conditions: {
          taskId: task.id,
          repositoryId: input.repositoryId,
          policyVersion: input.policyVersion,
        },
      })),
    });

    const execution = await tx.execution.create({
      data: {
        taskId: task.id,
        agentId: input.agentId,
        providerKey: 'openai',
        model: 'codex',
        status: 'CREATED',
      },
    });

    await audit.write({
      eventType: 'sponsorship.granted',
      actorType: 'human',
      actorId: input.initiatorId,
      repositoryId: input.repositoryId,
      taskId: task.id,
      executionId: execution.id,
      policyVersion: input.policyVersion,
      reasonCode: 'policy.task_sponsorship_granted',
      severity: 'info',
      metadata: {
        agentId: input.agentId,
        capabilities: input.capabilities,
        expiresAt: input.expiresAt?.toISOString(),
      },
    });

    await audit.write({
      eventType: 'execution.created',
      actorType: 'system',
      actorId: 'gitagent-control-plane',
      repositoryId: input.repositoryId,
      taskId: task.id,
      executionId: execution.id,
      policyVersion: input.policyVersion,
      reasonCode: 'execution.created',
      severity: 'info',
      metadata: { agentId: input.agentId },
    });

    return { task, execution };
  });
}
