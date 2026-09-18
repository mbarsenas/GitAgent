type GrantConditions = {
  taskId?: string;
  executionId?: string;
  scope?: string;
  [key: string]: unknown;
};

export function grantMatchesTaskScope(conditions: unknown, taskId: string, executionId?: string) {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  const typed = conditions as GrantConditions;
  if (typed.taskId !== taskId) return false;
  if (typed.executionId && executionId && typed.executionId !== executionId) return false;
  return true;
}
