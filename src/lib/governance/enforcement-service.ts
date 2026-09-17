import { prisma } from '@/lib/db/prisma';
import { grantMatchesTaskScope } from '@/lib/policy/task-scope';
import {
  authorizeCapability,
  type AgentRole,
  type Capability,
} from './capabilities';

type PersistedCapabilityInput = {
  role: AgentRole;
  capability: Capability;
  actorId: string;
  taskId: string;
  repositoryId: string;
  executionId?: string;
  targetOwnerAgentId?: string;
  policyVersion: string;
};

type CapabilityDecision = {
  allowed: boolean;
  reasonCode: string;
};

export async function enforcePersistedCapability(
  input: PersistedCapabilityInput,
): Promise<CapabilityDecision> {
  const agent = await prisma.agent.findUnique({ where: { id: input.actorId } });
  if (!agent || agent.status !== 'ACTIVE') {
    return deny('policy.agent_inactive');
  }

  const task = await prisma.task.findUnique({ where: { id: input.taskId } });
  if (!task || task.repositoryId !== input.repositoryId) {
    return deny('policy.task_repository_mismatch');
  }

  const selfReview =
    input.targetOwnerAgentId !== undefined &&
    input.targetOwnerAgentId === input.actorId &&
    (input.capability === 'pr.review' || input.capability === 'pr.approve');

  if (selfReview) {
    return auditDeny(input, 'policy.self_approval_denied');
  }

  const grants = await prisma.capabilityGrant.findMany({
    where: {
      agentId: input.actorId,
      capability: input.capability,
      effect: 'ALLOW',
      OR: [{ resource: '*' }, { resource: input.repositoryId }],
      AND: [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      ],
    },
  });

  const scopedGrants = grants.filter(
    (grant) =>
      !input.executionId ||
      grantMatchesTaskScope(grant.conditions, input.taskId, input.executionId),
  );

  const decision = authorizeCapability(
    {
      agentId: input.actorId,
      role: input.role,
      capabilities: scopedGrants.length > 0 ? [input.capability] : [],
      implementationAgentId: task.agentId ?? undefined,
    },
    input.capability,
  );

  if (!decision.allowed) {
    return auditDeny(input, decision.auditEvent);
  }

  await prisma.auditEvent.create({
    data: {
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: 'capability.allowed',
      actorType: 'agent',
      actorId: input.actorId,
      payload: {
        capability: input.capability,
        repositoryId: input.repositoryId,
        role: input.role,
        capabilityGrantId: scopedGrants[0]?.id ?? null,
        policyVersion: input.policyVersion,
      },
    },
  });

  return { allowed: true, reasonCode: 'policy.capability_allowed' };
}

function deny(reasonCode: string): CapabilityDecision {
  return { allowed: false, reasonCode };
}

async function auditDeny(
  input: PersistedCapabilityInput,
  reasonCode: string,
): Promise<CapabilityDecision> {
  await prisma.auditEvent.create({
    data: {
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: 'capability.denied',
      actorType: 'agent',
      actorId: input.actorId,
      payload: {
        capability: input.capability,
        repositoryId: input.repositoryId,
        role: input.role,
        reasonCode,
        policyVersion: input.policyVersion,
      },
    },
  });

  return deny(reasonCode);
}
