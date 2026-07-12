import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Store current pathname in headers to read in layouts/server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Match all paths except static files, favicon, public folder images, and api routes
    '/((?!_next/static|_next/image|favicon.ico|icon-512.png|favicon.svg|public/|avatars/|api/).*)',
  ],
};
