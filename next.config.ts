import type { NextConfig } from "next";
import os from "os";

// Detect local network IPs dynamically so any developer's machine works on phones/LAN
function getNetworkDevOrigins(): string[] {
  const origins: string[] = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          origins.push(`http://${iface.address}:3000`);
          origins.push(`https://${iface.address}:3000`);
          // Also allow hostname-only form (matches "192.168.1.51" without scheme/port)
          origins.push(iface.address);
        }
      }
    }
  } catch {}
  return origins;
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 's4.anilist.co', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.myanimelist.net', pathname: '/**' },
      { protocol: 'https', hostname: 'media.kitsu.io', pathname: '/**' },
      { protocol: 'https', hostname: 'img.zakoanime.com', pathname: '/**' },
      { protocol: 'https', hostname: 'gogocdn.net', pathname: '/**' },
      { protocol: 'https', hostname: 'anilist.co', pathname: '/**' },
      { protocol: 'https', hostname: 'artworks.thetvdb.com', pathname: '/**' },
    ],
  },
  allowedDevOrigins: ['localhost', '127.0.0.1', ...getNetworkDevOrigins()],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
