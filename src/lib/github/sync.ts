import { prisma } from '@/lib/db/prisma';
import { getGitHubAppConfig } from './config';
import { listInstallationRepositories } from './auth';

export async function syncGitHubInstallationRepositories(userId: string, installationId: string) {
  const config = getGitHubAppConfig();
  const installation = await listInstallationRepositories(installationId);
  const synced = [];

  for (const repo of installation.repositories) {
    const numericExternalId = String(repo.id);
    const fullName = `${repo.owner.login}/${repo.name}`;

    let record = await prisma.repository.findUnique({
      where: { provider_externalId: { provider: 'github', externalId: numericExternalId } },
    });

    if (record && record.userId && record.userId !== userId) {
      throw new Error(`Repository ${fullName} is already assigned to another GitAgent account.`);
    }

    if (!record) {
      const legacy = await prisma.repository.findFirst({
        where: {
          provider: 'github',
          owner: repo.owner.login,
          name: repo.name,
          OR: [{ userId }, { userId: null }],
        },
      });

      record = legacy
        ? await prisma.repository.update({
            where: { id: legacy.id },
            data: {
              externalId: numericExternalId,
              owner: repo.owner.login,
              name: repo.name,
              defaultBranch: repo.default_branch,
              userId,
            },
          })
        : await prisma.repository.create({
            data: {
              provider: 'github',
              externalId: numericExternalId,
              owner: repo.owner.login,
              name: repo.name,
              defaultBranch: repo.default_branch,
              userId,
            },
          });
    } else {
      record = await prisma.repository.update({
        where: { id: record.id },
        data: {
          owner: repo.owner.login,
          name: repo.name,
          defaultBranch: repo.default_branch,
          userId,
        },
      });
    }

    const duplicates = await prisma.repository.findMany({
      where: {
        provider: 'github',
        owner: repo.owner.login,
        name: repo.name,
        userId,
        NOT: { id: record.id },
      },
    });

    for (const duplicate of duplicates) {
      const moved = await prisma.$transaction(async (tx) => {
        const [taskCount, agentCount, grants] = await Promise.all([
          tx.task.count({ where: { repositoryId: duplicate.id } }),
          tx.agent.count({ where: { repositoryId: duplicate.id } }),
          tx.capabilityGrant.findMany({ where: { resource: duplicate.id } }),
        ]);

        await tx.task.updateMany({ where: { repositoryId: duplicate.id }, data: { repositoryId: record!.id } });
        await tx.agent.updateMany({ where: { repositoryId: duplicate.id }, data: { repositoryId: record!.id } });

        let grantCount = 0;
        for (const grant of grants) {
          const equivalent = await tx.capabilityGrant.findFirst({
            where: {
              agentId: grant.agentId,
              capability: grant.capability,
              resource: record!.id,
              effect: grant.effect,
            },
          });
          if (equivalent) await tx.capabilityGrant.delete({ where: { id: grant.id } });
          else await tx.capabilityGrant.update({ where: { id: grant.id }, data: { resource: record!.id } });
          grantCount++;
        }

        await tx.repository.delete({ where: { id: duplicate.id } });
        return { taskCount, agentCount, grantCount };
      });

      await prisma.auditEvent.create({
        data: {
          eventType: 'github.repository.reconciled',
          actorType: 'SYSTEM',
          actorId: userId,
          payload: {
            canonicalRepositoryId: record.id,
            removedDuplicateRepositoryId: duplicate.id,
            fullName,
            movedTasks: moved.taskCount,
            movedAgents: moved.agentCount,
            reconciledCapabilityGrants: moved.grantCount,
            policyVersion: '2026-09-16.1',
          },
        },
      });
    }

    synced.push(record);
  }

  await prisma.auditEvent.create({
    data: {
      eventType: 'github.installation.synced',
      actorType: 'USER',
      actorId: userId,
      payload: {
        installationId,
        appSlug: config.appSlug,
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

  return { repositories: synced, expiresAt: installation.expiresAt, repositorySelection: installation.repositorySelection };
}
