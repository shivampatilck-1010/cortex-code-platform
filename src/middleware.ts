import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/classroom', '/dashboard', '/admin'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Allow token-based assessment launches or live guest sessions
  const hasToken =
    request.nextUrl.searchParams.has('token') ||
    request.nextUrl.searchParams.has('launchToken') ||
    request.nextUrl.searchParams.has('sebToken');
  const isLiveGuestRoom = pathname.includes('/live/');

  if (hasToken || isLiveGuestRoom) {
    return NextResponse.next();
  }

  // Validate session cookie presence
  const sessionCookie = request.cookies.get('cortex_session')?.value;
  if (!sessionCookie || !sessionCookie.trim()) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(redirectUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/classroom',
    '/classroom/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/admin',
    '/admin/:path*',
  ],
};
