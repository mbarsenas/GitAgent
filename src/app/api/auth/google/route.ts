import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return new NextResponse('Google sign-in is not configured.', { status: 503 });

  const state = crypto.randomUUID();
  const callback = new URL('/api/auth/google/callback', request.nextUrl.origin);
  const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callback.toString());
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', 'openid email profile');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authorize);
  response.cookies.set('gitagent_google_oauth_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600,
  });
  return response;
}
