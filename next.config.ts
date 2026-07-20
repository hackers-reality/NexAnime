import type { NextConfig } from "next";

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
