import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheMaxMemorySize: 52428800,

  // Next.js's built-in "Running TypeScript ..." build step spawns worker
  // threads that crash Bun 1.3.14 with SIGSEGV/SIGILL on some CI runners
  // (https://bun.report/1.3.14/...). Type-checking is run separately via
  // `bunx tsc --noEmit` (see .github/workflows/lint.yml), so it's safe to
  // skip it here.
  typescript: {
    ignoreBuildErrors: true,
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  experimental: {},

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
