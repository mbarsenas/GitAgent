import { createSign } from 'node:crypto';
import { getGitHubAppConfig, getGitHubAppPrivateKey } from './config';

const GITHUB_API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function createGitHubAppJwt() {
  const config = getGitHubAppConfig();
  if (!config.appId) throw new Error('GITHUB_APP_ID is not configured.');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: config.appId,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(getGitHubAppPrivateKey(config)).toString('base64url');
  return `${unsigned}.${signature}`;
}

async function githubFetch<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'GitAgent-Control',
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export type GitHubInstallationToken = {
  token: string;
  expires_at: string;
  permissions?: Record<string, string>;
  repository_selection?: string;
};

export async function createInstallationToken(installationId: string) {
  if (!installationId) throw new Error('GitHub installation ID is required.');
  return githubFetch<GitHubInstallationToken>(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    createGitHubAppJwt(),
    { method: 'POST' },
  );
}

export type GitHubInstallationRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
};

export async function listInstallationRepositories(installationId: string) {
  const installation = await createInstallationToken(installationId);
  const result = await githubFetch<{
    total_count: number;
    repositories: GitHubInstallationRepository[];
  }>(`${GITHUB_API}/installation/repositories?per_page=100`, installation.token);

  return {
    expiresAt: installation.expires_at,
    repositorySelection: installation.repository_selection,
    repositories: result.repositories,
  };
}

export async function verifyGitHubInstallation(installationId: string) {
  try {
    const result = await listInstallationRepositories(installationId);
    return { ok: true as const, ...result };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Unknown GitHub authentication error',
      repositories: [] as GitHubInstallationRepository[],
    };
  }
}
