export const codingCapabilities = ['repo.read', 'branch.create', 'branch.write', 'pr.create'];
export function validateTaskInput(body: Record<string, unknown>) {
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200 ||
      typeof body.goal !== 'string' || !body.goal.trim() || body.goal.length > 20_000 ||
      typeof body.repositoryId !== 'string' || typeof body.agentId !== 'string') throw new Error('INVALID_TASK_INPUT');
  const maxCostUsd = Number(body.maxCostUsd ?? 1);
  const maxTokens = Number(body.maxTokens ?? 20_000);
  if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0 || maxCostUsd > 100 ||
      !Number.isInteger(maxTokens) || maxTokens < 1000 || maxTokens > 200_000) throw new Error('INVALID_TASK_BUDGET');
  if (body.capabilities !== undefined && (!Array.isArray(body.capabilities) || body.capabilities.some(c => !codingCapabilities.includes(c)))) throw new Error('INVALID_TASK_CAPABILITIES');
  return { title: body.title.trim(), goal: body.goal.trim(), maxCostUsd, maxTokens };
}
