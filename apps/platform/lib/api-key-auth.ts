import { getSystemDb, apiKeys, eq, and, isNull, or, gte } from '@aic/db';

/**
 * Resolves an AIC API key to the organisation it belongs to.
 *
 * Exists because the insurance endpoints were session-authenticated, which
 * meant an insurer — the only party they are for — could not call them.
 *
 * KNOWN LIMITATION, recorded rather than hidden. Keys are stored as bcrypt
 * hashes and `keyPrefix` is the constant "aic_live_" for every key, so there is
 * nothing to index on and verification is a scan: bcrypt.compare against each
 * active key until one matches. At AIC's current scale (single-digit keys) that
 * is fine. It does not stay fine. The fix is a `keyLookup` column holding a
 * SHA-256 of the key for O(1) retrieval, with bcrypt kept for the actual
 * verification — a small migration, deliberately not bundled into this change
 * so the demo-blocking fix ships on its own.
 */
export async function resolveApiKey(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!key.startsWith('aic_live_')) return null;

  const db = getSystemDb();
  const rows = await db
    .select({ id: apiKeys.id, orgId: apiKeys.orgId, keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.isActive, true),
        // A key with no expiry set never expires; one with an expiry must not
        // have passed it.
        or(isNull(apiKeys.expiresAt), gte(apiKeys.expiresAt, new Date()))
      )
    );

  const bcrypt = await import('bcryptjs');
  for (const row of rows) {
    if (!row.keyHash) continue;
    if (await bcrypt.default.compare(key, row.keyHash)) {
      // Best effort — a failed touch must not fail the request.
      try {
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, row.id));
      } catch {
        /* ignore */
      }
      return row.orgId;
    }
  }
  return null;
}
