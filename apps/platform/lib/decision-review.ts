/**
 * The human approval gate: a system sends a decision, AIC holds it, a named
 * person approves or overrides it, and the system is told the result.
 *
 * This file holds the pure parts (validation, callback signing, expiry) so they
 * can be tested without a database or network.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { isIP } from 'net';

export const DEFAULT_REVIEW_HOURS = 72;
export const MAX_REVIEW_HOURS = 24 * 30;

/** Per-organisation secret used to sign callbacks; shown to the org's admins. */
export function orgCallbackSecret(orgId: string) {
  const base = process.env.INTEGRATIONS_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!base) throw new Error('No server secret configured for callback signing');
  return 'whsec_' + createHmac('sha256', base).update(`aic-decision-callback:${orgId}`).digest('hex').slice(0, 40);
}

export function signCallback(secret: string, body: string, timestamp: number) {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verifyCallback(secret: string, body: string, timestamp: number, signature: string) {
  const expected = Buffer.from(signCallback(secret, body, timestamp));
  const got = Buffer.from(signature);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

function privateV4(ip: string) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return privateV4(ip);
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return privateV4(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
  }
  return false;
}

/**
 * A callback URL must be https and must not point inside AIC's own network.
 * The address is checked again at send time against what DNS returns, because
 * a name can resolve somewhere else later.
 */
export function validateCallbackUrl(raw: unknown, allowPrivate = process.env.CALLBACK_ALLOW_PRIVATE === '1'): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'callback_url must be a string' };
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { ok: false, error: 'callback_url is not a valid URL' }; }
  if (u.protocol !== 'https:' && !(allowPrivate && u.protocol === 'http:')) return { ok: false, error: 'callback_url must use https' };
  if (u.username || u.password) return { ok: false, error: 'callback_url must not contain credentials' };
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || isPrivateAddress(host))) {
    return { ok: false, error: 'callback_url must be a public address' };
  }
  if (u.toString().length > 2000) return { ok: false, error: 'callback_url is too long' };
  return { ok: true, url: u.toString() };
}

export function reviewDeadline(hours: unknown, now = new Date()) {
  const h = typeof hours === 'number' && Number.isFinite(hours) ? Math.min(Math.max(hours, 1), MAX_REVIEW_HOURS) : DEFAULT_REVIEW_HOURS;
  return new Date(now.getTime() + h * 3_600_000);
}

export function isExpired(status: string, dueAt: Date | string | null, now = new Date()) {
  return status === 'pending' && !!dueAt && new Date(dueAt).getTime() < now.getTime();
}

/** What the system that sent the decision is told. Never includes the reviewer's email. */
export function publicReview(d: {
  id: string; externalRef: string | null; reviewStatus: string; outcome: unknown; finalOutcome: unknown;
  reviewedAt: Date | string | null; reviewNote: string | null; reviewDueAt: Date | string | null; reviewerName?: string | null;
}) {
  return {
    id: d.id,
    external_ref: d.externalRef,
    review_status: d.reviewStatus,
    final_outcome: d.reviewStatus === 'overridden' ? d.finalOutcome : d.reviewStatus === 'approved' ? d.outcome : null,
    reviewed_at: d.reviewedAt ? new Date(d.reviewedAt).toISOString() : null,
    reviewer: d.reviewerName ?? null,
    note: d.reviewNote,
    review_due_at: d.reviewDueAt ? new Date(d.reviewDueAt).toISOString() : null,
  };
}
