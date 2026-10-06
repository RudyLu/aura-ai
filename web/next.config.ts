import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@google-cloud/firestore', '@google-cloud/storage'],
  async rewrites() {
    return [{ source: '/.well-known/apple-app-site-association', destination: '/api/aasa' }];
  }
};

export default nextConfig;
