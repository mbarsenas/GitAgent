export type ReviewVerdict = { verdict: 'APPROVE' | 'REQUEST_CHANGES'; summary: string; findings: string[] };

export function parseReviewVerdict(text: string): ReviewVerdict {
  const value = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim());
  if (!value || !['APPROVE', 'REQUEST_CHANGES'].includes(value.verdict) ||
      typeof value.summary !== 'string' || !value.summary.trim() ||
      !Array.isArray(value.findings) || value.findings.some((v: unknown) => typeof v !== 'string')) {
    throw new Error('Independent review returned an invalid verdict.');
  }
  if (value.verdict === 'APPROVE' && value.findings.length) {
    throw new Error('Independent review cannot approve unresolved findings.');
  }
  return value;
}

export function reviewMatchesHead(payload: unknown, headSha: string): boolean {
  const p = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return p.headSha === headSha && p.reviewVerdict === 'APPROVE' && p.reviewGitHubApp === 'gitagent-review';
}

export function requireCompleteDiff(files: Array<{ filename: string; patch?: string }>, changedFiles: number) {
  if (!Number.isInteger(changedFiles) || changedFiles < 1 || files.length !== changedFiles ||
      files.some(f => !f.patch) || JSON.stringify(files).length > 180_000) {
    throw new Error('Pull request diff is incomplete or too large for independent review.');
  }
}
