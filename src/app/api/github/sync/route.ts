import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { syncGitHubInstallationRepositories } from '@/lib/github/sync';
import { publicError } from '@/lib/http/public-error';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await requireCurrentUser();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, githubInstallationId: true },
    });

    if (!user?.githubInstallationId) {
      return NextResponse.json(
        { ok: false, error: 'No GitHub App installation is connected to this account.' },
        { status: 400 },
      );
    }

    const result = await syncGitHubInstallationRepositories(user.id, user.githubInstallationId);

    return NextResponse.json({
      ok: true,
      repositoryCount: result.repositories.length,
      repositories: result.repositories.map((repo) => ({
        id: repo.id,
        externalId: repo.externalId,
        fullName: `${repo.owner}/${repo.name}`,
        defaultBranch: repo.defaultBranch,
      })),
      tokenExpiresAt: result.expiresAt,
    });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === 'UNAUTHENTICATED';
    return NextResponse.json({ ok: false, error: publicError(error, 'GitHub repository sync failed.') }, { status: unauthenticated ? 401 : 500 });
  }
}
