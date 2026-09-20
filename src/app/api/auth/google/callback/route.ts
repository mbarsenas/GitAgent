import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { signSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get('gitagent_google_oauth_state')?.value;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const authSecret = process.env.AUTH_SECRET;
  const redirectUri = new URL('/api/auth/google/callback', request.nextUrl.origin).toString();

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/signin?error=invalid_state', request.url));
  }
  if (!clientId || !clientSecret || !authSecret) {
    return NextResponse.redirect(new URL('/signin?error=not_configured', request.url));
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) return NextResponse.redirect(new URL('/signin?error=oauth_failed', request.url));

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }, cache: 'no-store',
  });
  if (!profileResponse.ok) return NextResponse.redirect(new URL('/signin?error=profile_failed', request.url));
  const profile = await profileResponse.json() as { email?: string; email_verified?: boolean; name?: string };
  if (!profile.email || profile.email_verified === false) {
    return NextResponse.redirect(new URL('/signin?error=email_required', request.url));
  }

  // Verified email is the current cross-provider account key.
  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: { name: profile.name || undefined },
    create: { email: profile.email, name: profile.name || undefined },
  });
  const session = await signSession({
    userId: user.id, email: user.email, name: user.name || undefined,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  }, authSecret);

  const response = NextResponse.redirect(new URL('/console', request.url));
  response.cookies.set('gitagent_session', session, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.delete('gitagent_google_oauth_state');
  return response;
}
