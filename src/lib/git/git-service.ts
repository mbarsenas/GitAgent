export type GitRepositoryRef = {
  owner: string;
  name: string;
};

export type GitBranch = {
  name: string;
  commitSha: string;
};

export type GitPullRequestInput = {
  repository: GitRepositoryRef;
  title: string;
  body?: string;
  head: string;
  base: string;
};

export type GitPullRequest = {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged';
};

export interface GitService {
  readonly key: string;
  getRepository(ref: GitRepositoryRef): Promise<unknown>;
  listBranches(ref: GitRepositoryRef): Promise<GitBranch[]>;
  createBranch(ref: GitRepositoryRef, branch: string, fromRef: string): Promise<GitBranch>;
  createPullRequest(input: GitPullRequestInput): Promise<GitPullRequest>;
}
