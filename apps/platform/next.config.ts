import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// Content Security Policy. Next's App Router injects small inline scripts to
// boot each page, so script-src needs 'unsafe-inline' until nonces are wired
// through; everything else is locked to this origin. Sentry's ingest is the
// only outside host the browser talks to.
const isHttps = (process.env.NEXTAUTH_URL || process.env.AUTH_URL || '').startsWith('https://');
// The AIC Aware page previews the badge image served by the public website.
const webOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_WEB_URL || process.env.WEB_URL || 'https://aiccertified.cloud').origin; } catch { return 'https://aiccertified.cloud'; } })();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${webOrigin} https://aiccertified.cloud https://www.google-analytics.com https://www.googletagmanager.com`,
  "font-src 'self' data:",
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  // The build runs on the same VPS as the live apps and the database, and was
  // being killed for lack of memory at "Collecting build traces". Trades a
  // little build time for a lower memory peak.
  //
  // It then died again at "Collecting page data", which by default starts one
  // worker per CPU, each loading the whole server bundle. One worker is slower
  // and fits. Lint is run before each commit, not here, for the same reason.
  experimental: {
    webpackMemoryOptimizations: true,
    cpus: 1,
    workerThreads: false,
  },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: [
    'minio',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'puppeteer',
    'pg',
    'bullmq',
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
          { key: 'Content-Security-Policy', value: csp },
          ...(isHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
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
