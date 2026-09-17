import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type GithubAuditBase = {
  taskId: string;
  executionId: string;
  repositoryId: string;
  actorId: string;
  policyVersion: string;
};

async function writeGithubAuditEvent(
  base: GithubAuditBase,
  eventType: string,
  metadata: Prisma.InputJsonObject,
) {
  const payload: Prisma.InputJsonObject = {
    repositoryId: base.repositoryId,
    policyVersion: base.policyVersion,
    reasonCode: 'github.operation_succeeded',
    severity: 'info',
    metadata,
  };

  return prisma.auditEvent.create({
    data: {
      taskId: base.taskId,
      executionId: base.executionId,
      eventType,
      actorType: 'implementation-agent',
      actorId: base.actorId,
      payload,
    },
  });
}

export function recordGithubBranchCreated(
  base: GithubAuditBase,
  input: { branch: string; baseRef: string },
) {
  return writeGithubAuditEvent(base, 'github.branch.created', input);
}

export function recordGithubCommitCreated(
  base: GithubAuditBase,
  input: { branch: string; commitSha: string; path?: string; message?: string },
) {
  const metadata: Prisma.InputJsonObject = {
    branch: input.branch,
    commitSha: input.commitSha,
    ...(input.path !== undefined ? { path: input.path } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
  };
  return writeGithubAuditEvent(base, 'github.commit.created', metadata);
}

export function recordGithubPullRequestCreated(
  base: GithubAuditBase,
  input: { pullRequestNumber: number; title: string; head: string; base: string; draft: boolean; url?: string },
) {
  const metadata: Prisma.InputJsonObject = {
    pullRequestNumber: input.pullRequestNumber,
    title: input.title,
    head: input.head,
    base: input.base,
    draft: input.draft,
    ...(input.url !== undefined ? { url: input.url } : {}),
  };
  return writeGithubAuditEvent(base, 'github.pr.created', metadata);
}
