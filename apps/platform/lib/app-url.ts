/**
 * The platform's public origin, for links that leave the building in an email.
 * AUTH_URL / NEXTAUTH_URL are what Auth.js already uses; a loopback value in
 * production (copied from .env.example) would send people a link to their own
 * machine, so it falls back to the real address instead.
 */
export function appUrl(): string {
  const env = process.env;
  const configured = (env['AUTH_URL'] || env['NEXTAUTH_URL'] || '').trim().replace(/\/+$/, '');
  const loopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(configured);
  if (configured && !(loopback && env.NODE_ENV === 'production')) return configured;
  return 'https://app.aiccertified.cloud';
}
