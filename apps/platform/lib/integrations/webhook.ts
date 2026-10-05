import { createHmac, timingSafeEqual } from 'crypto';

/** GitHub's X-Hub-Signature-256 check: HMAC-SHA256 of the raw body with the webhook secret. */
export function validGitHubSignature(rawBody: string, header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Events that can change a check's verdict, so they are worth a sync. */
export const SYNC_EVENTS = new Set([
  'installation_repositories',
  'branch_protection_rule',
  'repository_ruleset',
  'pull_request',
  'pull_request_review',
  'dependabot_alert',
  'secret_scanning_alert',
  'repository',
  'organization',
]);

/**
 * Many events arrive in bursts (a merged pull request brings several). One
 * sync per organisation a minute after the last event is enough.
 */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
export function debounce(key: string, fn: () => void, ms = 60_000) {
  const t = pending.get(key);
  if (t) clearTimeout(t);
  pending.set(key, setTimeout(() => { pending.delete(key); fn(); }, ms));
}
