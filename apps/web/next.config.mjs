/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    '@trakyahaber/database',
    '@trakyahaber/config',
    '@trakyahaber/logger',
    '@trakyahaber/queue',
    '@trakyahaber/types',
    '@trakyahaber/ai',
    '@trakyahaber/ui',
  ],
};

export default nextConfig;
