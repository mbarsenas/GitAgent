import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ task: { create: vi.fn() }, execution: { create: vi.fn() }, capabilityGrant: { createMany: vi.fn() }, approval: { create: vi.fn() }, auditEvent: { createMany: vi.fn() } }));
vi.mock('@/lib/db/prisma', () => ({ prisma: { $transaction: (fn: (tx: typeof m) => unknown) => fn(m) } }));
import { createGovernedTask } from '../create-task';
const input = { repositoryId: 'repo', agentId: 'agent', initiatorId: 'owner', title: 'Fix', goal: 'Fix error', capabilities: ['repo.read'], policyVersion: 'test' };
beforeEach(() => {
  vi.clearAllMocks(); m.task.create.mockImplementation(async ({ data }) => ({ id: 'task', ...data }));
  m.execution.create.mockImplementation(async ({ data }) => ({ id: 'run', ...data }));
  m.approval.create.mockResolvedValue({ id: 'approval' });
});
describe('restricted task handoff', () => {
  it('holds the task while binding approval to the same unstarted execution', async () => {
    const result = await createGovernedTask({ ...input, restricted: true });
    expect(result.task.status).toBe('WAITING_APPROVAL'); expect(result.execution.status).toBe('CREATED');
    expect(m.approval.create).toHaveBeenCalledWith({ data: expect.objectContaining({ taskId: result.task.id, executionId: result.execution.id, resourceId: result.execution.id, resourceType: 'execution', status: 'PENDING' }) });
    const events = m.auditEvent.createMany.mock.calls[0][0].data;
    expect(events).toContainEqual(expect.objectContaining({ eventType: 'restricted.execution.approval_requested', payload: expect.objectContaining({ approvalId: 'approval', executionId: result.execution.id }) }));
  });
  it('does not impose a restricted-execution approval on trusted tasks', async () => {
    const result = await createGovernedTask(input);
    expect(result.task.status).toBe('QUEUED'); expect(m.approval.create).not.toHaveBeenCalled();
  });
});
