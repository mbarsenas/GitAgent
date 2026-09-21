import { prisma } from '@/lib/db/prisma';
import { ownedExecutionWhere } from './tenant-filters';

export { isRepositoryOwnedBy, ownedExecutionWhere } from './tenant-filters';

export async function requireOwnedExecution(executionId: string, userId: string) {
  const execution = await prisma.execution.findFirst({
    where: ownedExecutionWhere(executionId, userId),
    select: { id: true },
  });
  if (!execution) throw new Error('EXECUTION_NOT_FOUND_OR_FORBIDDEN');
  return execution;
}
