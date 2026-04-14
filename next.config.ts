import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Cloudflare R2 public bucket (stored inspirations, creatives, brand assets)
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      // Meta / Facebook CDN (scraped ad images shown in the import gallery)
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '*.facebook.com',
      },
    ],
  },
}

export default nextConfig
