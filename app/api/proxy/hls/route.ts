// NexAnime — HLS Proxy Route
// Proxies HLS playlists and segments through our server to bypass CORS
// Rewrites m3u8 URIs to point back through this proxy

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = [
  'mega-cloud.top',
  'megacloud.club',
  'megacloud.fun',
  'megacloud.win',
  'swiftstream.top',
  'animetsu.cc',
  'animetsu.live',
];

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_HOSTS.some(h => hostname.includes(h)) || hostname.endsWith('.anilist.co');
  } catch {
    return false;
  }
}

function rewriteM3u8(body: string, proxyBase: string): string {
  return body.replace(/^(?!#)(.+\.m3u8.*)$/gm, (match) => {
    try {
      const absolute = new URL(match, proxyBase).toString();
      return `${proxyBase}?url=${encodeURIComponent(absolute)}`;
    } catch {
      return match;
    }
  }).replace(/^(?!#)(.+\.ts.*)$/gm, (match) => {
    try {
      const absolute = new URL(match, proxyBase).toString();
      return `${proxyBase}?url=${encodeURIComponent(absolute)}`;
    } catch {
      return match;
    }
  }).replace(/URI="([^"]+)"/g, (match, uri) => {
    try {
      const absolute = new URL(uri, proxyBase).toString();
      return `URI="${proxyBase}?url=${encodeURIComponent(absolute)}"`;
    } catch {
      return match;
    }
  });
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  if (!isAllowedHost(targetUrl)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': 'https://animetsu.cc/',
        'Origin': 'https://animetsu.cc',
        'Accept-Encoding': 'identity',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3u8 = contentType.includes('mpegurl') || targetUrl.includes('.m3u8') || targetUrl.includes('m3u8');

    if (isM3u8) {
      const body = await upstreamRes.text();
      const proxyBase = `${request.nextUrl.origin}/api/proxy/hls`;
      const rewritten = rewriteM3u8(body, proxyBase);

      return new NextResponse(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=5',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Stream segments through without buffering
    const reader = upstreamRes.body?.getReader();
    if (!reader) {
      return new NextResponse(null, { status: 500 });
    }

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
      async cancel() {
        reader.releaseLock();
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': contentType || 'video/mp2t',
        'Cache-Control': 'public, max-age=3600, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('[HLS Proxy] Error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Proxy error' },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
