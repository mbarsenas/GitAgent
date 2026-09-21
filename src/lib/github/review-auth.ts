import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

function base64url(value: string | Buffer) { return Buffer.from(value).toString('base64url'); }

function reviewConfig() {
  return {
    appId: process.env.GITHUB_REVIEW_APP_ID ?? '',
    appSlug: process.env.GITHUB_REVIEW_APP_SLUG ?? 'gitagent-review',
    installationId: process.env.GITHUB_REVIEW_APP_INSTALLATION_ID ?? '',
    privateKey: process.env.GITHUB_REVIEW_APP_PRIVATE_KEY,
    privateKeyPath: process.env.GITHUB_REVIEW_APP_PRIVATE_KEY_PATH,
  };
}

function privateKey() {
  const config = reviewConfig();
  if (config.privateKey) return config.privateKey.replace(/\\n/g, '\n');
  if (config.privateKeyPath) return readFileSync(resolve(process.cwd(), config.privateKeyPath), 'utf8');
  throw new Error('GitHub Review App private key is not configured.');
}

function jwt() {
  const config = reviewConfig();
  if (!config.appId) throw new Error('GITHUB_REVIEW_APP_ID is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.appId }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  return `${unsigned}.${signer.sign(privateKey()).toString('base64url')}`;
}

export function isReviewAppConfigured() {
  const c = reviewConfig();
  return Boolean(c.appId && (c.privateKey || c.privateKeyPath));
}

async function discoverReviewInstallationId(owner: string, repo: string) {
  const response = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/installation`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt()}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'GitAgent-Review',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`GitAgent-Review is not installed on ${owner}/${repo}. Install the review app on this repository before requesting human merge approval.`);
    }
    throw new Error(`GitHub Review App installation lookup failed (${response.status}).`);
  }

  const result = await response.json() as { id: number };
  return String(result.id);
}

export async function createReviewInstallationToken(owner?: string, repo?: string) {
  const config = reviewConfig();
  if (!isReviewAppConfigured()) throw new Error('GitHub Review App is not fully configured.');

  // Repository-specific discovery is authoritative for multi-tenant use.
  // The legacy environment installation ID is only a fallback for callers
  // that do not provide a repository.
  const installationId = owner && repo
    ? await discoverReviewInstallationId(owner, repo)
    : config.installationId;

  if (!installationId) {
    throw new Error('GitHub Review App installation is not configured for this repository.');
  }

  const response = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST', cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${jwt()}`, 'X-GitHub-Api-Version': API_VERSION, 'User-Agent': 'GitAgent-Review' },
  });
  if (!response.ok) throw new Error(`GitHub Review App request failed (${response.status}).`);
  const result = await response.json() as { token: string; expires_at: string };
  return { ...result, appSlug: config.appSlug, installationId };
}
