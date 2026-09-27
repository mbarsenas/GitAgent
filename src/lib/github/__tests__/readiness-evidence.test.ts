import { describe, expect, it } from 'vitest';
import { isExactIndependentApproval } from '../readiness-evidence';

const evidence = {
  actorId: 'gitagent_review_agent', taskId: 'task', executionId: 'run',
  execution: { id: 'run', agentId: 'repository-implementation', taskId: 'task' },
  payload: { reviewGitHubApp: 'gitagent-review', pullRequestNumber: 22,
    reviewerAgentId: 'gitagent_review_agent', implementationAgentId: 'repository-implementation' },
};

describe('readiness execution evidence', () => {
  it('recognizes the live repository agent reviewed by the legacy reviewer', () => {
    expect(isExactIndependentApproval(evidence)).toBe(true);
  });
  it('rejects self approval and identities unrelated to the actual execution', () => {
    expect(isExactIndependentApproval({ ...evidence, actorId: 'repository-implementation',
      payload: { ...evidence.payload, reviewerAgentId: 'repository-implementation' } })).toBe(false);
    expect(isExactIndependentApproval({ ...evidence,
      payload: { ...evidence.payload, implementationAgentId: 'demo-implementation' } })).toBe(false);
    expect(isExactIndependentApproval({ ...evidence, actorId: 'unrelated-reviewer' })).toBe(false);
  });
  it('rejects missing or mismatched execution and task bindings', () => {
    expect(isExactIndependentApproval({ ...evidence, execution: null })).toBe(false);
    expect(isExactIndependentApproval({ ...evidence, actorId: null })).toBe(false);
    expect(isExactIndependentApproval({ ...evidence, executionId: 'other' })).toBe(false);
    expect(isExactIndependentApproval({ ...evidence, taskId: 'other' })).toBe(false);
  });
  it('requires the independent GitHub App and a valid PR number', () => {
    for (const pullRequestNumber of [0, -1, 1.5, '22', undefined]) {
      expect(isExactIndependentApproval({ ...evidence, payload: { ...evidence.payload, pullRequestNumber } })).toBe(false);
    }
    expect(isExactIndependentApproval({ ...evidence,
      payload: { ...evidence.payload, reviewGitHubApp: 'gitagent-control' } })).toBe(false);
  });
});
