import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    'minio',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'puppeteer',
    'pg',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',       value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry-specific options
  silent: true,
  org: "aic-pulse",
  project: "platform",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
