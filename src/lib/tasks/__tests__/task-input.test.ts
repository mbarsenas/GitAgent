import { describe, expect, it } from 'vitest';
import { validateTaskInput } from '../task-input';
const input = { title: 'Fix', goal: 'Fix the error', repositoryId: 'repo', agentId: 'agent' };
describe('task request boundaries', () => {
  it('accepts bounded coding tasks', () => { expect(validateTaskInput(input).maxTokens).toBe(20000); });
  it('rejects a caller trying to grant merge, secrets, or review privileges', () => {
    for (const capability of ['pr.merge', 'secrets.read', 'review.approve', '*']) expect(() => validateTaskInput({ ...input, capabilities: [capability] })).toThrow('INVALID_TASK_CAPABILITIES');
  });
  it('rejects missing goals and invalid budgets', () => {
    for (const update of [{ goal: '' }, { maxTokens: -1 }, { maxTokens: 1.5 }, { maxCostUsd: Infinity }, { maxCostUsd: -10 }]) expect(() => validateTaskInput({ ...input, ...update })).toThrow();
  });
});
