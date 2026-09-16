import { prisma } from '@/lib/db/prisma';
import { getGitHubAppConfig } from './config';
import { listInstallationRepositories } from './auth';

export async function syncGitHubInstallationRepositories() {
  const config = getGitHubAppConfig();
  const installation = await listInstallationRepositories();
  const synced = [];

  for (const repo of installation.repositories) {
    const record = await prisma.repository.upsert({
      where: {
        provider_externalId: {
          provider: 'github',
          externalId: String(repo.id),
        },
      },
      update: {
        owner: repo.owner.login,
        name: repo.name,
        defaultBranch: repo.default_branch,
      },
      create: {
        provider: 'github',
        externalId: String(repo.id),
        owner: repo.owner.login,
        name: repo.name,
        defaultBranch: repo.default_branch,
      },
    });
    synced.push(record);
  }

  await prisma.auditEvent.create({
    data: {
      eventType: 'github.installation.synced',
      actorType: 'SYSTEM',
      actorId: config.appSlug,
      payload: {
        installationId: config.installationId,
        repositorySelection: installation.repositorySelection ?? null,
        repositoryCount: synced.length,
        repositories: synced.map((repo) => ({
          id: repo.id,
          externalId: repo.externalId,
          fullName: `${repo.owner}/${repo.name}`,
          defaultBranch: repo.defaultBranch,
        })),
        tokenExpiresAt: installation.expiresAt,
        result: 'success',
      },
    },
  });

  return {
    repositories: synced,
    expiresAt: installation.expiresAt,
    repositorySelection: installation.repositorySelection,
  };
}
