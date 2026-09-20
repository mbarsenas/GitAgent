import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set(['/']);
const PUBLIC_PREFIXES = ['/api/github/webhook'];

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="GitAgent Console", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The marketing homepage and GitHub webhook stay public.
  if (PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Next.js internals and common public assets must remain reachable by the marketing page.
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  const username = process.env.CONSOLE_AUTH_USER;
  const password = process.env.CONSOLE_AUTH_PASSWORD;

  // Fail closed: protected routes are inaccessible if production credentials are missing.
  if (!username || !password) {
    return new NextResponse('Console authentication is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Basic ')) return unauthorized();

  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return unauthorized();

    const suppliedUser = decoded.slice(0, separator);
    const suppliedPassword = decoded.slice(separator + 1);

    if (suppliedUser !== username || suppliedPassword !== password) return unauthorized();
    return NextResponse.next();
  } catch {
    return unauthorized();
  }
}

export const config = {
  matcher: ['/((?!.*\\.[^/]+$).*)'],
};
