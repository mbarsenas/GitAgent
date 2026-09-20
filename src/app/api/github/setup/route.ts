import { NextRequest, NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getGitHubAppConfig } from '@/lib/github/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await requireCurrentUser();
    const config = getGitHubAppConfig();

    if (!config.appSlug) {
      return NextResponse.redirect(new URL('/settings/github?error=github_app_not_configured', request.url));
    }

    // GitHub redirects to the configured Setup URL with installation_id.
    const installationId = request.nextUrl.searchParams.get('installation_id');
    const setupAction = request.nextUrl.searchParams.get('setup_action');

    if (!installationId) {
      return NextResponse.redirect(new URL('/settings/github?error=missing_installation_id', request.url));
    }

    const conflict = await prisma.user.findFirst({
      where: {
        githubInstallationId: installationId,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (conflict) {
      return NextResponse.redirect(new URL('/settings/github?error=installation_already_linked', request.url));
    }

    await prisma.user.update({
      where: { id: session.userId },
      data: { githubInstallationId: installationId },
    });

    await prisma.auditEvent.create({
      data: {
        eventType: 'github.installation.linked',
        actorType: 'USER',
        actorId: session.userId,
        payload: {
          installationId,
          setupAction: setupAction ?? null,
          appSlug: config.appSlug,
          result: 'success',
        },
      },
    });

    const target = new URL('/settings/github', request.url);
    target.searchParams.set('linked', '1');
    return NextResponse.redirect(target);
  } catch {
    const signin = new URL('/signin', request.url);
    signin.searchParams.set('next', '/settings/github');
    return NextResponse.redirect(signin);
  }
}
