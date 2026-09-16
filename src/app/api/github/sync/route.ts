import { NextResponse } from 'next/server';
import { syncGitHubInstallationRepositories } from '@/lib/github/sync';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncGitHubInstallationRepositories();
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'GitHub repository sync failed',
      },
      { status: 500 },
    );
  }
}
