import { randomBytes } from 'node:crypto';

/**
 * AIC Aware badge codes and status.
 *
 * Format AWR-XXXX-XXXX in Crockford base32 (no I, L, O, U), 40 bits of
 * randomness — enough that codes cannot be enumerated from the verify endpoint,
 * short enough to read aloud or type from a printed badge.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const BADGE_CODE_RE = /^AWR-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
export const BADGE_VALIDITY_MONTHS = 12;

export function generateBadgeCode(bytes: Buffer = randomBytes(5)): string {
  // 40 bits fits exactly in a double, so plain arithmetic is safe here.
  let n = 0;
  for (const b of bytes.subarray(0, 5)) n = n * 256 + b;
  let s = '';
  for (let i = 0; i < 8; i++) {
    s = ALPHABET[n % 32] + s;
    n = Math.floor(n / 32);
  }
  return `AWR-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Accepts lower case and the Crockford look-alikes a person may type. */
export function normaliseBadgeCode(input: string): string | null {
  const s = input.trim().toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
  return BADGE_CODE_RE.test(s) ? s : null;
}

export function badgeExpiry(issuedAt: Date): Date {
  const d = new Date(issuedAt);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + BADGE_VALIDITY_MONTHS);
  // 29 Feb + 12 months rolls into March; pin to the last day of February instead.
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

export type BadgeStatus = 'valid' | 'expired' | 'revoked';

export function badgeStatus(
  badge: { expiresAt: Date | string; revokedAt: Date | string | null },
  now: Date = new Date()
): BadgeStatus {
  if (badge.revokedAt) return 'revoked';
  return new Date(badge.expiresAt).getTime() <= now.getTime() ? 'expired' : 'valid';
}
