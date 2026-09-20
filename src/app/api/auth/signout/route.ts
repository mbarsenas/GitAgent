import { NextRequest, NextResponse } from 'next/server';

function clearAuthCookies(response: NextResponse) {
  response.cookies.set('gitagent_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.delete('gitagent_oauth_state');
  response.cookies.delete('gitagent_google_oauth_state');
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/signed-out', request.url));
  clearAuthCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/signed-out', request.url), 303);
  clearAuthCookies(response);
  return response;
}
