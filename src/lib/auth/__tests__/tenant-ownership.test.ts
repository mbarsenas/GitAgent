import { describe, expect, it } from 'vitest';
import { isRepositoryOwnedBy, ownedExecutionWhere } from '../tenant-filters';

describe('tenant ownership boundaries', () => {
  it('rejects nullable and cross-tenant repository ownership', () => {
    expect(isRepositoryOwnedBy(null, 'user-a')).toBe(false);
    expect(isRepositoryOwnedBy('user-b', 'user-a')).toBe(false);
    expect(isRepositoryOwnedBy('user-a', 'user-a')).toBe(true);
  });

  it('binds execution reads to the signed-in repository owner', () => {
    expect(ownedExecutionWhere('execution-a', 'user-a')).toEqual({
      id: 'execution-a',
      task: { repository: { userId: 'user-a' } },
    });
  });
});
