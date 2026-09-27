import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ execution: { findUnique: vi.fn() }, agent: { findUnique: vi.fn() }, capabilityGrant: { findFirst: vi.fn() }, auditEvent: { findMany: vi.fn(), create: vi.fn() }, model: vi.fn(), token: vi.fn(), configured: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma: m }));
vi.mock('../review-auth', () => ({ createReviewInstallationToken: m.token, isReviewAppConfigured: m.configured }));
vi.mock('../independent-review', () => ({ reviewPullRequestDiff: m.model }));
import { performPullRequestReview } from '../review-boundary';
const head = { sha: 'head-a', ref: 'gitagent/run', repo: { full_name: 'owner/repo' } };
const event = (type: string, sha = 'head-a') => ({ eventType: type, payload: { pullRequestNumber: 1, headSha: sha, reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-review' } });
let events: ReturnType<typeof event>[];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('fetch', m.fetch); events = [event('github.pr.created')];
  m.execution.findUnique.mockResolvedValue({ id: 'run', agentId: 'implementer', agent: { id: 'implementer' }, taskId: 'task', task: { goal: 'Fix error', repository: { id: 'repo', owner: 'owner', name: 'repo' } }, workspace: { branch: 'gitagent/run' } });
  m.agent.findUnique.mockResolvedValue({ id: 'reviewer', name: 'Reviewer', status: 'ACTIVE' });
  m.capabilityGrant.findFirst.mockResolvedValue({ id: 'grant' }); m.configured.mockReturnValue(true); m.token.mockResolvedValue({ token: 'test-token', appSlug: 'gitagent-review' });
  m.auditEvent.findMany.mockImplementation(async ({ where }) => events.filter(e => e.eventType === where.eventType));
  m.model.mockResolvedValue({ verdict: 'APPROVE', summary: 'Checked the change.', findings: [] });
  m.fetch.mockImplementation(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? { id: 9, state: 'APPROVED', html_url: 'https://github.com/owner/repo/pull/1' } : url.includes('/files?') ? [{ filename: 'a.ts', patch: '+fixed' }] : { state: 'open', head, changed_files: 1 }), { status: 200 }));
});
afterEach(() => vi.unstubAllGlobals());
describe('live review boundary with mocked external services', () => {
  it('inspects the diff and submits evidence for the inspected commit', async () => {
    const result = await performPullRequestReview('run', 1, 'reviewer', 'REVIEW');
    expect(result.allowed).toBe(true); expect(m.model).toHaveBeenCalledWith(expect.objectContaining({ headSha: 'head-a', files: [{ filename: 'a.ts', patch: '+fixed' }] }));
    const post = m.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post![1].body)).toMatchObject({ commit_id: 'head-a', event: 'COMMENT' });
    expect(m.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ payload: expect.objectContaining({ headSha: 'head-a', reviewVerdict: 'APPROVE' }) }) }));
  });
  it('does not submit a review when the reviewer finds a blocking issue', async () => {
    m.model.mockResolvedValue({ verdict: 'REQUEST_CHANGES', summary: 'Unsafe', findings: ['Missing ownership check'] });
    expect((await performPullRequestReview('run', 1, 'reviewer', 'REVIEW')).allowed).toBe(false);
    expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
  it('rejects approval based on a review of an earlier commit', async () => {
    events.push(event('github.review.created', 'old-head'));
    const result = await performPullRequestReview('run', 1, 'reviewer', 'APPROVE');
    expect(result.allowed).toBe(false); expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
  it('rejects a head change during review before posting to GitHub', async () => {
    const original = m.fetch.getMockImplementation()!;
    let prReads = 0;
    m.fetch.mockImplementation(async (url, init) => {
      if (!init?.method && !url.includes('/files?') && ++prReads === 2) return new Response(JSON.stringify({ head: { ...head, sha: 'head-b' } }));
      return original(url, init);
    });
    await expect(performPullRequestReview('run', 1, 'reviewer', 'REVIEW')).rejects.toThrow('changed during review');
    expect(m.fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });
  it('denies self-review without GitHub or model calls', async () => {
    expect((await performPullRequestReview('run', 1, 'implementer', 'APPROVE')).allowed).toBe(false);
    expect(m.fetch).not.toHaveBeenCalled(); expect(m.model).not.toHaveBeenCalled();
  });
});
