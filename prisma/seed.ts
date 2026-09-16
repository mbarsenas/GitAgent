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

  const task = await prisma.task.create({
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
  });

  const execution = await prisma.execution.create({
    data: {
      taskId: task.id,
      agentId: agent.id,
      providerKey: 'openai',
      model: 'codex',
    },
  });

  console.log({
    repositoryId: repository.id,
    agentId: agent.id,
    taskId: task.id,
    executionId: execution.id,
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
