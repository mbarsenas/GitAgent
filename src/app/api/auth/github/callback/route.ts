import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { signSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get('gitagent_oauth_state')?.value;
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const authSecret = process.env.AUTH_SECRET;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/signin?error=invalid_state', request.url));
  }
  if (!clientId || !clientSecret || !authSecret) {
    return NextResponse.redirect(new URL('/signin?error=not_configured', request.url));
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    cache: 'no-store',
  });
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return NextResponse.redirect(new URL('/signin?error=oauth_failed', request.url));

  const headers = { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' };
  const [userResponse, emailResponse] = await Promise.all([
    fetch('https://api.github.com/user', { headers, cache: 'no-store' }),
    fetch('https://api.github.com/user/emails', { headers, cache: 'no-store' }),
  ]);
  if (!userResponse.ok) return NextResponse.redirect(new URL('/signin?error=profile_failed', request.url));

  const profile = await userResponse.json() as { login: string; name?: string; email?: string };
  const emails = emailResponse.ok ? await emailResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }> : [];
  const email = profile.email || emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email;
  if (!email) return NextResponse.redirect(new URL('/signin?error=email_required', request.url));

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: profile.name || profile.login },
    create: { email, name: profile.name || profile.login },
  });

  const session = await signSession({
    userId: user.id, email: user.email, name: user.name || profile.login,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  }, authSecret);

  const response = NextResponse.redirect(new URL('/console', request.url));
  response.cookies.set('gitagent_session', session, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.delete('gitagent_oauth_state');
  return response;
}
