import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@google-cloud/firestore', '@google-cloud/storage']
};

export default nextConfig;
