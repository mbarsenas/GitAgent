import { describe, expect, it } from 'vitest';
import { isDocumentationOnly, validateRepositoryPath } from '../validation-scope';

describe('repository snapshot validation scope', () => {
  it('recognizes documentation changes without treating source changes as docs', () => {
    expect(isDocumentationOnly(['README.md', 'docs/operations/recovery.md'])).toBe(true);
    expect(isDocumentationOnly(['README.md', 'src/app/api/agent/run/route.ts'])).toBe(false);
    expect(isDocumentationOnly([])).toBe(false);
  });

  it('rejects repository paths that could escape the sandbox worktree', () => {
    expect(validateRepositoryPath('src/app/page.tsx')).toBe('src/app/page.tsx');
    for (const unsafe of ['../secret', 'src/../secret', '/etc/passwd', 'src\\secret', 'src//page.tsx']) {
      expect(() => validateRepositoryPath(unsafe)).toThrow('unsafe path');
    }
  });
});
