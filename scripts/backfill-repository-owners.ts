import { readFile } from 'node:fs/promises';
import { prisma } from '../src/lib/db/prisma';

type OwnerMap = Record<string, string>;

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadMap(path: string): Promise<OwnerMap> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Owner map must be a JSON object of repositoryId -> userId.');
  }
  if (Object.entries(parsed).some(([repositoryId, userId]) => !repositoryId || typeof userId !== 'string' || !userId)) {
    throw new Error('Owner map contains an invalid repositoryId or userId.');
  }
  return parsed as OwnerMap;
}

async function main() {
  const mapPath = option('--map');
  const apply = process.argv.includes('--apply');

  const unowned = await prisma.repository.findMany({
    where: { userId: null },
    select: { id: true, provider: true, externalId: true, owner: true, name: true, createdAt: true },
    orderBy: [{ provider: 'asc' }, { owner: 'asc' }, { name: 'asc' }],
  });

  if (!mapPath) {
    console.log(JSON.stringify({
      ok: unowned.length === 0,
      unownedRepositories: unowned,
      nextStep: unowned.length === 0
        ? 'Ownership is complete. Run the NOT NULL cutover migration after recording this result.'
        : 'Provide an explicit reviewed map with --map ownership-map.json. This script will not infer owners.',
    }, null, 2));
    process.exitCode = unowned.length === 0 ? 0 : 2;
    return;
  }

  const ownerMap = await loadMap(mapPath);
  const unownedIds = new Set(unowned.map((repository) => repository.id));
  const unknownRepositoryIds = Object.keys(ownerMap).filter((id) => !unownedIds.has(id));
  const missingRepositoryIds = unowned.filter((repository) => !ownerMap[repository.id]).map((repository) => repository.id);
  if (unknownRepositoryIds.length || missingRepositoryIds.length) {
    throw new Error(JSON.stringify({
      error: 'Ownership map must cover every and only currently unowned repository.',
      unknownRepositoryIds,
      missingRepositoryIds,
    }));
  }

  const userIds = [...new Set(Object.values(ownerMap))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  const knownUserIds = new Set(users.map((user) => user.id));
  const unknownUserIds = userIds.filter((id) => !knownUserIds.has(id));
  if (unknownUserIds.length) throw new Error(`Ownership map references unknown users: ${unknownUserIds.join(', ')}`);

  if (!apply) {
    console.log(JSON.stringify({ ok: true, dryRun: true, assignments: ownerMap, message: 'Validated only. Re-run with --apply to write ownership.' }, null, 2));
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const repository of unowned) {
      const userId = ownerMap[repository.id];
      const update = await tx.repository.updateMany({ where: { id: repository.id, userId: null }, data: { userId } });
      if (update.count !== 1) throw new Error(`Repository ${repository.id} changed during backfill; no ownership was written.`);
      await tx.auditEvent.create({
        data: {
          eventType: 'repository.ownership.backfilled',
          actorType: 'system',
          actorId: userId,
          payload: { repositoryId: repository.id, repository: `${repository.owner}/${repository.name}`, userId, source: 'explicit-reviewed-owner-map' },
        },
      });
    }
  });

  const remaining = await prisma.repository.count({ where: { userId: null } });
  if (remaining !== 0) throw new Error(`Backfill incomplete: ${remaining} repositories remain unowned.`);
  console.log(JSON.stringify({ ok: true, applied: true, assigned: unowned.length, remainingUnowned: remaining }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
