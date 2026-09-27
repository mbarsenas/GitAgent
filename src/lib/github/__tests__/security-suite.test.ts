import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ execution: { findUnique: vi.fn() }, auditEvent: { findMany: vi.fn(), create: vi.fn() }, self: vi.fn(), merge: vi.fn(), branch: vi.fn(), workspace: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: m }));
vi.mock('../review-boundary', () => ({ attemptPullRequestApproval: m.self }));
vi.mock('../merge-boundary', () => ({ attemptMergeAsAgent: m.merge }));
vi.mock('../negative-controls', () => ({ evaluateProtectedBranchWrite: m.branch, evaluateWorkspaceWrite: m.workspace }));
import { verifyExecutionBoundaries } from '../security-suite';
let events: Array<{ eventType: string; actorId: string; payload: Record<string, unknown> }>;
beforeEach(() => {
  vi.clearAllMocks();
  m.execution.findUnique.mockResolvedValue({ id: 'run', agentId: 'implementer', taskId: 'task', workspace: { ownerAgentId: 'implementer', repositoryId: 'repo' }, task: { repositoryId: 'repo', repository: { defaultBranch: 'main' }, approvals: [{ executionId: 'run', resourceType: 'github.pull_request', resourceId: '1', action: 'pr.merge:1', status: 'PENDING' }] } });
  const payload = { pullRequestNumber: 1, headSha: 'head', reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-review', reviewerAgentId: 'reviewer', implementationAgentId: 'implementer' };
  events = ['github.pr.created', 'github.review.created', 'github.review.approved'].map(eventType => ({ eventType, actorId: 'reviewer', payload: { ...payload } }));
  m.auditEvent.findMany.mockImplementation(async () => events);
  m.self.mockResolvedValue({ allowed: false, reasonCode: 'policy.self_approval_denied', githubRequestSent: false });
  m.merge.mockResolvedValue({ allowed: false, githubRequestSent: false });
  m.branch.mockResolvedValue({ allowed: false, githubRequestSent: false });
  m.workspace.mockResolvedValue({ allowed: false, writeAttempted: false });
});
describe('automatic execution security verification', () => {
  it('records nine observed checks using actual review evidence', async () => {
    const result = await verifyExecutionBoundaries('run', 1);
    expect(result.passed).toBe(true); expect(result.checks).toHaveLength(9);
    expect(m.merge).toHaveBeenCalledWith('run', 1, 'implementer');
    expect(m.merge).toHaveBeenCalledWith('run', 1, 'reviewer');
    expect(m.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'security.suite.completed', payload: expect.objectContaining({ passed: true, headSha: 'head' }) }) }));
  });
  it('does not fabricate success when a denial boundary fails', async () => {
    m.self.mockResolvedValue({ allowed: true, githubRequestSent: true });
    expect((await verifyExecutionBoundaries('run', 1)).passed).toBe(false);
  });
  it('does not consider old generic reviews evidence of actual inspection', async () => {
    events.forEach(e => { delete e.payload.headSha; delete e.payload.reviewVerdict; });
    expect((await verifyExecutionBoundaries('run', 1)).passed).toBe(false);
  });
  it('rejects a PR unrelated to this execution before running probes', async () => {
    await expect(verifyExecutionBoundaries('run', 2)).rejects.toThrow('Execution-bound');
    expect(m.self).not.toHaveBeenCalled(); expect(m.auditEvent.create).not.toHaveBeenCalled();
  });
});
