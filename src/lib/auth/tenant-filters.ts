export function isRepositoryOwnedBy(repositoryUserId: string | null, userId: string) {
  return repositoryUserId !== null && repositoryUserId === userId;
}

export function ownedExecutionWhere(executionId: string, userId: string) {
  return { id: executionId, task: { repository: { userId } } };
}
