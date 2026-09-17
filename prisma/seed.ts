import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.upsert({ where: { email: 'demo@gitagent.local' }, update: {}, create: { email: 'demo@gitagent.local', name: 'GitAgent Demo User' } });
  const repository = await prisma.repository.upsert({ where: { provider_externalId: { provider: 'github', externalId: '1373462743' } }, update: { owner: 'mbarsenas', name: 'GitAgent', defaultBranch: 'main' }, create: { provider: 'github', externalId: '1373462743', owner: 'mbarsenas', name: 'GitAgent', defaultBranch: 'main' } });
  const agent = await prisma.agent.upsert({ where: { slug: 'demo-implementation-agent' }, update: { repositoryId: repository.id }, create: { name: 'Demo Implementation Agent', slug: 'demo-implementation-agent', providerKey: 'openai', model: 'codex', repositoryId: repository.id } });
  const reviewer = await prisma.agent.upsert({ where: { slug: 'demo-review-agent' }, update: { repositoryId: repository.id }, create: { name: 'Demo Review Agent', slug: 'demo-review-agent', providerKey: 'openai', model: 'codex-review', repositoryId: repository.id } });
  const capabilities = ['repository.read', 'branch.create', 'branch.write', 'pr.create'];
  for (const capability of capabilities) { const existing = await prisma.capabilityGrant.findFirst({ where: { agentId: agent.id, capability, resource: repository.id, effect: 'ALLOW' } }); if (!existing) await prisma.capabilityGrant.create({ data: { agentId: agent.id, capability, resource: repository.id, effect: 'ALLOW', conditions: { scope: 'demo-sponsored-task', repository: `${repository.owner}/${repository.name}` } } }); }
  const reviewCapabilities = ['repository.read', 'review.approve'];
  for (const capability of reviewCapabilities) { const existing = await prisma.capabilityGrant.findFirst({ where: { agentId: reviewer.id, capability, resource: repository.id, effect: 'ALLOW' } }); if (!existing) await prisma.capabilityGrant.create({ data: { agentId: reviewer.id, capability, resource: repository.id, effect: 'ALLOW', conditions: { scope: 'independent-review', repository: `${repository.owner}/${repository.name}`, writableImplementationWorkspace: false } } }); }
  const existingTask = await prisma.task.findFirst({ where: { title: 'Demonstrate self-approval denial', repositoryId: repository.id, agentId: agent.id }, orderBy: { createdAt: 'desc' } });
  const task = existingTask ?? await prisma.task.create({ data: { title: 'Demonstrate self-approval denial', goal: 'Attempt self-approval and verify GitAgent denies and audits the action.', repositoryId: repository.id, agentId: agent.id, initiatorId: user.id, maxCostUsd: 1, maxTokens: 20000, requiresHumanApproval: true } });
  const existingExecution = await prisma.execution.findFirst({ where: { taskId: task.id, agentId: agent.id }, orderBy: { createdAt: 'desc' } });
  const execution = existingExecution ?? await prisma.execution.create({ data: { taskId: task.id, agentId: agent.id, providerKey: 'openai', model: 'codex' } });
  console.log({ repositoryId: repository.id, externalId: repository.externalId, agentId: agent.id, reviewerAgentId: reviewer.id, taskId: task.id, executionId: execution.id, capabilities, reviewCapabilities });
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
