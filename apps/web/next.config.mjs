/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
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
