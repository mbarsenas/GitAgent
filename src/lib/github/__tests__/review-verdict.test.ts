import { describe, expect, it } from 'vitest';
import { parseReviewVerdict, requireCompleteDiff, reviewMatchesHead } from '../review-verdict';

describe('independent review evidence', () => {
  it('accepts a substantive clean verdict and preserves requested changes', () => {
    expect(parseReviewVerdict('{"verdict":"APPROVE","summary":"Checked error handling and ownership.","findings":[]}').verdict).toBe('APPROVE');
    expect(parseReviewVerdict('{"verdict":"REQUEST_CHANGES","summary":"Unauthorized access.","findings":["Scope query to owner"]}').verdict).toBe('REQUEST_CHANGES');
  });
  it('fails closed on malformed, contradictory, and incomplete verdicts', () => {
    for (const text of ['{}', 'approve', 'null', '{"verdict":"APPROVE","summary":"","findings":[]}', '{"verdict":"APPROVE","summary":"Unsafe","findings":["SQL injection"]}']) expect(() => parseReviewVerdict(text)).toThrow();
  });
  it('rejects legacy approvals, stale heads, and a different review principal', () => {
    expect(reviewMatchesHead({ headSha: 'a', reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-review' }, 'a')).toBe(true);
    expect(reviewMatchesHead({ headSha: 'a', reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-review' }, 'b')).toBe(false);
    expect(reviewMatchesHead({ reviewGitHubApp: 'gitagent-review' }, 'a')).toBe(false);
    expect(reviewMatchesHead({ headSha: 'a', reviewVerdict: 'APPROVE', reviewGitHubApp: 'gitagent-control' }, 'a')).toBe(false);
  });
  it('rejects omitted files, binary patches, empty and oversized diffs', () => {
    expect(() => requireCompleteDiff([{ filename: 'a', patch: '+fixed' }], 1)).not.toThrow();
    expect(() => requireCompleteDiff([{ filename: 'a', patch: '+fixed' }], 2)).toThrow();
    expect(() => requireCompleteDiff([{ filename: 'binary' }], 1)).toThrow();
    expect(() => requireCompleteDiff([], 0)).toThrow();
    expect(() => requireCompleteDiff([{ filename: 'a', patch: 'x'.repeat(180_001) }], 1)).toThrow();
  });
});
