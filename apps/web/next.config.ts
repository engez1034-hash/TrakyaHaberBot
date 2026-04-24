import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Allow all https images (can tighten per domain in production)
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  // Ensure Prisma and database package are handled correctly as server-only
  serverExternalPackages: ["@prisma/client", "@trakyahaber/database"],
};

export default nextConfig;
