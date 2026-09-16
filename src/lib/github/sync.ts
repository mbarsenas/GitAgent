import { prisma } from '@/lib/db/prisma';
import { getGitHubAppConfig } from './config';
import { listInstallationRepositories } from './auth';

export async function syncGitHubInstallationRepositories() {
  const config = getGitHubAppConfig();
  const installation = await listInstallationRepositories();
  const synced = [];

  for (const repo of installation.repositories) {
    const numericExternalId = String(repo.id);
    const fullName = `${repo.owner.login}/${repo.name}`;
    let record = await prisma.repository.findUnique({ where: { provider_externalId: { provider: 'github', externalId: numericExternalId } } });

    if (!record) {
      const legacy = await prisma.repository.findFirst({ where: { provider: 'github', owner: repo.owner.login, name: repo.name } });
      if (legacy) {
        record = await prisma.repository.update({ where: { id: legacy.id }, data: { externalId: numericExternalId, owner: repo.owner.login, name: repo.name, defaultBranch: repo.default_branch } });
      } else {
        record = await prisma.repository.create({ data: { provider: 'github', externalId: numericExternalId, owner: repo.owner.login, name: repo.name, defaultBranch: repo.default_branch } });
      }
    } else {
      record = await prisma.repository.update({ where: { id: record.id }, data: { owner: repo.owner.login, name: repo.name, defaultBranch: repo.default_branch } });
    }

    const duplicates = await prisma.repository.findMany({ where: { provider: 'github', owner: repo.owner.login, name: repo.name, NOT: { id: record.id } } });
    for (const duplicate of duplicates) {
      const [taskCount, agentCount] = await Promise.all([prisma.task.count({ where: { repositoryId: duplicate.id } }), prisma.agent.count({ where: { repositoryId: duplicate.id } })]);
      if (taskCount === 0 && agentCount === 0) await prisma.repository.delete({ where: { id: duplicate.id } });
      else await prisma.auditEvent.create({ data: { eventType: 'github.repository.duplicate_detected', actorType: 'SYSTEM', actorId: config.appSlug, payload: { canonicalRepositoryId: record.id, duplicateRepositoryId: duplicate.id, fullName, taskCount, agentCount, action: 'retained_for_safe_migration' } } });
    }
    synced.push(record);
  }

  await prisma.auditEvent.create({ data: { eventType: 'github.installation.synced', actorType: 'SYSTEM', actorId: config.appSlug, payload: { installationId: config.installationId, repositorySelection: installation.repositorySelection ?? null, repositoryCount: synced.length, repositories: synced.map((repo) => ({ id: repo.id, externalId: repo.externalId, fullName: `${repo.owner}/${repo.name}`, defaultBranch: repo.defaultBranch })), tokenExpiresAt: installation.expiresAt, result: 'success' } } });
  return { repositories: synced, expiresAt: installation.expiresAt, repositorySelection: installation.repositorySelection };
}
