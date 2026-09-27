import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  execution: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  task: { update: vi.fn() }, auditEvent: { create: vi.fn() },
  transaction: vi.fn(), seal: vi.fn(), configured: vi.fn(), trust: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({ prisma: { ...mocks, $transaction: mocks.transaction } }));
vi.mock('@/lib/governance/workspace', () => ({ sealExecutionWorkspace: mocks.seal, authorizeWorkspaceWrite: vi.fn() }));
vi.mock('@/lib/agent/llm', () => ({ isImplementationLlmConfigured: mocks.configured, generateCodingPlan: vi.fn(), generateValidationRepair: vi.fn() }));
vi.mock('@/lib/github/trust-lifecycle', () => ({ getAgentTrustState: mocks.trust }));
import { runRepositoryAgent } from '../repository-agent';
const execution = { id: 'run', agent: { id: 'agent', status: 'ACTIVE' }, task: { id: 'task', agentId: 'agent', approvals: [], repository: { owner: 'owner', name: 'repo', user: { githubInstallationId: '123' } } } };
beforeEach(() => { vi.clearAllMocks(); mocks.execution.findUnique.mockResolvedValue(execution); mocks.execution.updateMany.mockResolvedValue({ count: 1 }); mocks.trust.mockResolvedValue('TRUSTED'); mocks.configured.mockReturnValue(false); mocks.transaction.mockResolvedValue([]); });
describe('execution lifecycle', () => {
  it('does not restart or fail another active execution when an atomic claim loses', async () => {
    mocks.execution.updateMany.mockResolvedValue({ count: 0 });
    await expect(runRepositoryAgent('run')).rejects.toThrow('already started');
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.seal).not.toHaveBeenCalled();
  });
  it('records missing model configuration as failure and seals the workspace', async () => {
    await expect(runRepositoryAgent('run')).rejects.toThrow('model is not configured');
    expect(mocks.execution.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
    expect(mocks.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'agent.execution.failed' }) }));
    expect(mocks.seal).toHaveBeenCalledWith('run');
  });
  it('finalizes policy-denied runs after claiming them', async () => {
    mocks.trust.mockResolvedValue('QUARANTINED');
    await expect(runRepositoryAgent('run')).rejects.toThrow('QUARANTINED');
    expect(mocks.seal).toHaveBeenCalledWith('run');
  });
});
