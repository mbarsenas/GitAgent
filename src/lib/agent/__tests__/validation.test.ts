import { describe, expect, it } from 'vitest';
import { isDocumentationOnly } from '../validation-scope';

describe('repository snapshot validation scope', () => {
  it('recognizes documentation changes without treating source changes as docs', () => {
    expect(isDocumentationOnly(['README.md', 'docs/operations/recovery.md'])).toBe(true);
    expect(isDocumentationOnly(['README.md', 'src/app/api/agent/run/route.ts'])).toBe(false);
    expect(isDocumentationOnly([])).toBe(false);
  });
});
