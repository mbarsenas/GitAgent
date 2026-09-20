import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  recordGithubBranchCreated,
  recordGithubCommitCreated,
  recordGithubPullRequestCreated,
} from '@/lib/git/github-audit';

const POLICY_VERSION = '2026-09-16.1';

export async function POST() {
  const repository = await prisma.repository.findFirst({ where: { provider: 'github', externalId: 'mbarsenas/GitAgent' } });
  const agent = await prisma.agent.findFirst({ where: { slug: 'demo-implementation-agent' } });
  const task = await prisma.task.findFirst({
    where: { repositoryId: repository?.id, agentId: agent?.id },
    orderBy: { createdAt: 'desc' },
  });
  const execution = task
    ? await prisma.execution.findFirst({ where: { taskId: task.id }, orderBy: { createdAt: 'desc' } })
    : null;

  if (!repository || !agent || !task || !execution) {
    return NextResponse.json({ ok: false, error: 'Missing seeded repository, agent, task, or execution.' }, { status: 400 });
  }

  const base = {
    taskId: task.id,
    executionId: execution.id,
    repositoryId: repository.id,
    actorId: agent.id,
    policyVersion: POLICY_VERSION,
  };

  const branch = 'gitagent/demo-governed-github';
  const commitSha = 'ece88100ef984c2e3b3895668b17de84a1a79d35';
  const pullRequestNumber = 3;
  const pullRequestUrl = 'https://github.com/mbarsenas/GitAgent/pull/3';

  const alreadyRecorded = await prisma.auditEvent.findFirst({
    where: {
      taskId: task.id,
      eventType: 'github.pr.created',
      payload: { path: ['metadata', 'pullRequestNumber'], equals: pullRequestNumber },
    },
  });

  if (!alreadyRecorded) {
    await recordGithubBranchCreated(base, { branch, baseRef: 'main' });
    await recordGithubCommitCreated(base, {
      branch,
      commitSha,
      path: 'docs/demo/GOVERNED-GITHUB-PROOF.md',
      message: 'demo: governed GitHub write',
    });
    await recordGithubPullRequestCreated(base, {
      pullRequestNumber,
      title: 'Demo: governed GitHub branch write',
      head: branch,
      base: 'main',
      draft: true,
      url: pullRequestUrl,
    });
  }

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    executionId: execution.id,
    agentId: agent.id,
    repositoryId: repository.id,
    branch,
    commitSha,
    pullRequestNumber,
    pullRequestUrl,
    recorded: !alreadyRecorded,
  });
}
