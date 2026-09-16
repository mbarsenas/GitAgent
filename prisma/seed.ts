import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@gitagent.local' },
    update: {},
    create: { email: 'demo@gitagent.local', name: 'GitAgent Demo User' },
  });

  const repository = await prisma.repository.upsert({
    where: { provider_externalId: { provider: 'github', externalId: 'mbarsenas/GitAgent' } },
    update: {},
    create: {
      provider: 'github',
      externalId: 'mbarsenas/GitAgent',
      owner: 'mbarsenas',
      name: 'GitAgent',
      defaultBranch: 'main',
    },
  });

  const agent = await prisma.agent.upsert({
    where: { slug: 'demo-implementation-agent' },
    update: { repositoryId: repository.id },
    create: {
      name: 'Demo Implementation Agent',
      slug: 'demo-implementation-agent',
      providerKey: 'openai',
      model: 'codex',
      repositoryId: repository.id,
    },
  });

  const capabilities = ['repository.read', 'branch.create', 'branch.write', 'pr.create'];
  for (const capability of capabilities) {
    const existing = await prisma.capabilityGrant.findFirst({
      where: { agentId: agent.id, capability, resource: repository.id, effect: 'ALLOW' },
    });
    if (!existing) {
      await prisma.capabilityGrant.create({
        data: {
          agentId: agent.id,
          capability,
          resource: repository.id,
          effect: 'ALLOW',
          conditions: { scope: 'demo-sponsored-task', repository: `${repository.owner}/${repository.name}` },
        },
      });
    }
  }

  const existingTask = await prisma.task.findFirst({
    where: {
      title: 'Demonstrate self-approval denial',
      repositoryId: repository.id,
      agentId: agent.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  const task =
    existingTask ??
    (await prisma.task.create({
      data: {
        title: 'Demonstrate self-approval denial',
        goal: 'Attempt self-approval and verify GitAgent denies and audits the action.',
        repositoryId: repository.id,
        agentId: agent.id,
        initiatorId: user.id,
        maxCostUsd: 1,
        maxTokens: 20000,
        requiresHumanApproval: true,
      },
    }));

  const existingExecution = await prisma.execution.findFirst({
    where: { taskId: task.id, agentId: agent.id },
    orderBy: { createdAt: 'desc' },
  });

  const execution =
    existingExecution ??
    (await prisma.execution.create({
      data: {
        taskId: task.id,
        agentId: agent.id,
        providerKey: 'openai',
        model: 'codex',
      },
    }));

  const auditSeedEvents = [
    {
      eventType: 'sponsorship.granted',
      actorType: 'human',
      actorId: user.id,
      payload: {
        repositoryId: repository.id,
        policyVersion: '2026-09-16.1',
        reasonCode: 'policy.sponsorship_granted',
        severity: 'info',
        metadata: {
          capabilityScope: capabilities,
          explanation: 'A human sponsor allowed this implementation agent to work only within the assigned task scope.',
        },
      },
    },
    {
      eventType: 'execution.created',
      actorType: 'system',
      actorId: 'gitagent',
      payload: {
        repositoryId: repository.id,
        policyVersion: '2026-09-16.1',
        reasonCode: 'execution.created',
        severity: 'info',
        metadata: {
          agentId: agent.id,
          explanation: 'GitAgent created an isolated execution record for the sponsored task.',
        },
      },
    },
  ];

  for (const event of auditSeedEvents) {
    const exists = await prisma.auditEvent.findFirst({
      where: {
        taskId: task.id,
        executionId: execution.id,
        eventType: event.eventType,
        actorId: event.actorId,
      },
    });

    if (!exists) {
      await prisma.auditEvent.create({
        data: {
          taskId: task.id,
          executionId: execution.id,
          eventType: event.eventType,
          actorType: event.actorType,
          actorId: event.actorId,
          payload: event.payload,
        },
      });
    }
  }

  console.log({
    repositoryId: repository.id,
    agentId: agent.id,
    taskId: task.id,
    executionId: execution.id,
    capabilities,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
