import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap) {
    if (now - data.timestamp > RATE_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_WINDOW);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (entry && now - entry.timestamp < RATE_WINDOW) {
      if (entry.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429 }
        );
      }
      entry.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, timestamp: now });
    }
  }

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
    '/((?!_next/static|_next/image|favicon.ico|icon-512.png|favicon.svg|public/|avatars/).*)',
  ],
};
