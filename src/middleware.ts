import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const PUBLIC_PATHS = new Set(['/', '/signin', '/signup']);
const PUBLIC_PREFIXES = ['/api/auth/', '/api/github/webhook'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return NextResponse.next();
  }

  const session = await verifySession(request.cookies.get('gitagent_session')?.value, process.env.AUTH_SECRET);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'authentication_required' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const signIn = new URL('/signin', request.url);
  signIn.searchParams.set('returnTo', pathname);
  return NextResponse.redirect(signIn);
}

export const config = { matcher: ['/((?!.*\\.[^/]+$).*)'] };
