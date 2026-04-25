/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
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
