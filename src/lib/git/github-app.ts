export type GitHubRepositoryRef = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  installationId: number;
};

export type GitHubBranchResult = {
  branch: string;
  sha?: string;
};

export type GitHubPullRequestResult = {
  number: number;
  url: string;
};

export interface GitHubAppClient {
  listRepositories(): Promise<GitHubRepositoryRef[]>;
  createBranch(repo: GitHubRepositoryRef, branchName: string, baseRef: string): Promise<GitHubBranchResult>;
  createTextFile(repo: GitHubRepositoryRef, branchName: string, path: string, content: string, message: string): Promise<{ commitSha: string }>;
  createDraftPullRequest(repo: GitHubRepositoryRef, head: string, base: string, title: string, body: string): Promise<GitHubPullRequestResult>;
}

export const GITHUB_INSTALLATION_ID_ENV = 'GITHUB_INSTALLATION_ID';
export const GITHUB_APP_ID_ENV = 'GITHUB_APP_ID';
export const GITHUB_APP_PRIVATE_KEY_ENV = 'GITHUB_APP_PRIVATE_KEY';

export function assertGitHubAppEnv() {
  const missing = [GITHUB_INSTALLATION_ID_ENV, GITHUB_APP_ID_ENV, GITHUB_APP_PRIVATE_KEY_ENV].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing GitHub App configuration: ${missing.join(', ')}`);
  }
}
