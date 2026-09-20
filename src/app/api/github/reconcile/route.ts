import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { syncGitHubInstallationRepositories } from '@/lib/github/sync';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await requireCurrentUser();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, githubInstallationId: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 401 });
    }

    if (!user.githubInstallationId) {
      return NextResponse.json({ ok: false, error: 'GitHub App installation is not connected for this account' }, { status: 409 });
    }

    const result = await syncGitHubInstallationRepositories(user.githubInstallationId, user.id);
    const repos = await prisma.repository.findMany({
      where: { provider: 'github', userId: user.id },
      orderBy: [{ owner: 'asc' }, { name: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({
      ok: true,
      reconciled: true,
      repositoryCount: repos.length,
      repositories: repos.map((repo) => ({
        id: repo.id,
        externalId: repo.externalId,
        fullName: `${repo.owner}/${repo.name}`,
        defaultBranch: repo.defaultBranch,
      })),
      syncedRepositories: result.repositories.map((repo) => ({
        id: repo.id,
        externalId: repo.externalId,
        fullName: `${repo.owner}/${repo.name}`,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
