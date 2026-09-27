import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ approval: { findUnique: vi.fn() }, auditEvent: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, task: { update: vi.fn() }, transaction: vi.fn(), seal: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { ...m, $transaction: m.transaction } }));
vi.mock('../auth', () => ({ createInstallationToken: vi.fn(async () => ({ token: 'test-token' })) }));
vi.mock('@/lib/governance/workspace', () => ({ sealExecutionWorkspace: m.seal }));
import { executeApprovedMerge } from '../merge-boundary';
let reviewedHead: string;
let humanHead: string;
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', m.fetch); reviewedHead = humanHead = 'current';
  m.approval.findUnique.mockResolvedValue({ id: 'approval', executionId: 'run', taskId: 'task', resourceId: '1', action: 'pr.merge:1', resourceType: 'github.pull_request', status: 'APPROVED', actorId: 'owner', task: { repository: { owner: 'owner', name: 'repo', userId: 'owner', user: { githubInstallationId: '123' } } } });
  m.auditEvent.findMany.mockImplementation(async ({ where }) => where.eventType === 'github.review.approved' ? [{ payload: { pullRequestNumber: 1, headSha: reviewedHead, reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-review', implementationAgentId: 'implementer', reviewerAgentId: 'reviewer' } }] : where.eventType === 'merge.approval.requested' ? [{ payload: { approvalId: 'approval', headSha: humanHead } }] : []);
  m.fetch.mockImplementation(async (_url, init) => new Response(JSON.stringify(init?.method === 'PUT' ? { merged: true, sha: 'merged' } : { state: 'open', draft: false, merged: false, head: { sha: 'current' } }), { status: 200 }));
  m.auditEvent.findFirst.mockResolvedValue({ payload: { passed: true, headSha: 'current', pullRequestNumber: 1 } });
  m.transaction.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());
describe('commit-bound human merge', () => {
  it('sends the reviewed head SHA to GitHub and seals after merge', async () => {
    expect((await executeApprovedMerge('approval', 'run', 1, 'owner')).merged).toBe(true);
    const put = m.fetch.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(put![1].body)).toEqual({ merge_method: 'squash', sha: 'current' });
    expect(m.seal).toHaveBeenCalledWith('run');
  });
  it('refuses stale independent review before sending a merge', async () => {
    reviewedHead = 'old'; await expect(executeApprovedMerge('approval', 'run', 1, 'owner')).rejects.toThrow('Independent review must approve');
    expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  });
  it('refuses a stale human approval even after a fresh independent review', async () => {
    humanHead = 'old'; await expect(executeApprovedMerge('approval', 'run', 1, 'owner')).rejects.toThrow('Human approval must cover');
    expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  });
  it('refuses merge when execution security checks failed', async () => {
    m.auditEvent.findFirst.mockResolvedValue({ payload: { passed: false, headSha: 'current', pullRequestNumber: 1 } });
    await expect(executeApprovedMerge('approval', 'run', 1, 'owner')).rejects.toThrow('security checks must pass');
    expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0);
  });
  it('rejects another tenant before calling GitHub', async () => {
    await expect(executeApprovedMerge('approval', 'run', 1, 'other')).rejects.toThrow('does not own');
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
