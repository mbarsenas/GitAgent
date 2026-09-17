import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

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

    const execution = await tx.execution.create({
      data: {
        taskId: task.id,
        agentId: input.agentId,
        providerKey: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
        status: 'CREATED',
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
          executionId: execution.id,
          repositoryId: input.repositoryId,
          policyVersion: input.policyVersion,
        },
      })),
    });

    const executionMarker = execution.id;

    const auditRows
      data: {
        taskId: task.id,
        agentId: input.agentId,
        providerKey: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-5.6-sol',
        status: 'CREATED',
      },
    });

    const auditRows: Prisma.AuditEventCreateManyInput[] = [
      {
        taskId: task.id,
        executionId: execution.id,
        eventType: 'sponsorship.granted',
        actorType: 'human',
        actorId: input.initiatorId,
        payload: {
          repositoryId: input.repositoryId,
          policyVersion: input.policyVersion,
          reasonCode: 'policy.task_sponsorship_granted',
          severity: 'info',
          metadata: {
            agentId: input.agentId,
            capabilities: input.capabilities,
            ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}),
          },
        },
      },
      {
        taskId: task.id,
        executionId: execution.id,
        eventType: 'execution.created',
        actorType: 'system',
        actorId: 'gitagent-control-plane',
        payload: {
          repositoryId: input.repositoryId,
          policyVersion: input.policyVersion,
          reasonCode: 'execution.created',
          severity: 'info',
          metadata: { agentId: input.agentId },
        },
      },
    ];

    await tx.auditEvent.createMany({ data: auditRows });

    void executionMarker;
    return { task, execution };
  });
}
