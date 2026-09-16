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
  metadata: Record<string, unknown>,
) {
  return prisma.auditEvent.create({
    data: {
      taskId: base.taskId,
      executionId: base.executionId,
      eventType,
      actorType: 'implementation-agent',
      actorId: base.actorId,
      payload: {
        repositoryId: base.repositoryId,
        policyVersion: base.policyVersion,
        reasonCode: 'github.operation_succeeded',
        severity: 'info',
        metadata,
      } satisfies Prisma.InputJsonValue,
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
  return writeGithubAuditEvent(base, 'github.commit.created', input);
}

export function recordGithubPullRequestCreated(
  base: GithubAuditBase,
  input: { pullRequestNumber: number; title: string; head: string; base: string; draft: boolean; url?: string },
) {
  return writeGithubAuditEvent(base, 'github.pr.created', input);
}
