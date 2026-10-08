import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow local preview assets from loopback and the explicitly configured phone-preview host.
  allowedDevOrigins: ['127.0.0.1', ...(URL.canParse(process.env.PUBLIC_URL || '') ? [new URL(process.env.PUBLIC_URL!).hostname] : [])],
  serverExternalPackages: ['@google-cloud/firestore', '@google-cloud/storage'],
  async rewrites() {
    return [{ source: '/.well-known/apple-app-site-association', destination: '/api/aasa' }];
  }
};

export default nextConfig;
