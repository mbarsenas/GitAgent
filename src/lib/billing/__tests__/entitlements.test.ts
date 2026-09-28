import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  billingSubscription: { findMany: vi.fn() },
  repository: { count: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({ prisma: mocks }));

import { assertRepositoryCapacity, assertRepositoryEntitled, getBillingPlan } from '../entitlements';

describe('billing entitlements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants only active or trialing paid plans and prefers Team', async () => {
    mocks.billingSubscription.findMany.mockResolvedValue([{ plan: 'pro' }, { plan: 'team' }]);
    await expect(getBillingPlan('user')).resolves.toBe('team');
    expect(mocks.billingSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', status: { in: ['active', 'trialing'] } } }));
  });

  it('rejects repository additions over the Preview limit', async () => {
    mocks.billingSubscription.findMany.mockResolvedValue([]);
    mocks.repository.count.mockResolvedValue(1);
    await expect(assertRepositoryCapacity('user', 1)).rejects.toThrow('PLAN_REPOSITORY_LIMIT:free:1');
  });

  it('blocks governed tasks on repositories outside the active plan allowance', async () => {
    mocks.billingSubscription.findMany.mockResolvedValue([{ plan: 'pro' }]);
    mocks.repository.findMany.mockResolvedValue(Array.from({ length: 11 }, (_, index) => ({ id: `repo-${index}` })));
    await expect(assertRepositoryEntitled('user', 'repo-10')).rejects.toThrow('PLAN_REPOSITORY_LIMIT:pro:10');
    await expect(assertRepositoryEntitled('user', 'repo-9')).resolves.toBeUndefined();
  });
});
