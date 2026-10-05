import { createHash } from 'crypto';
import { getSystemDb, apiKeys, eq, and, isNull, or, gte } from '@aic/db';

/**
 * Resolves an AIC API key to the organisation it belongs to.
 *
 * Exists because the insurance endpoints were session-authenticated, which
 * meant an insurer — the only party they are for — could not call them.
 *
 * Keys are found by a SHA-256 lookup column (db/manual/012) and verified with
 * bcrypt. Keys created before that column existed are found by the old scan
 * once, and gain their lookup value on first use.
 */
export const apiKeyLookup = (key: string) => createHash('sha256').update(key).digest('hex');

export async function resolveApiKey(request: Request): Promise<string | null> {
  const header = request.headers.get('authorization') || '';
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!key.startsWith('aic_live_') || key.length > 200) return null;

  const db = getSystemDb();
  const live = and(eq(apiKeys.isActive, true), or(isNull(apiKeys.expiresAt), gte(apiKeys.expiresAt, new Date())));
  const lookup = apiKeyLookup(key);

  // One indexed row, verified with bcrypt.
  let rows = await db
    .select({ id: apiKeys.id, orgId: apiKeys.orgId, keyHash: apiKeys.keyHash, keyLookup: apiKeys.keyLookup })
    .from(apiKeys)
    .where(and(live, eq(apiKeys.keyLookup, lookup)));
  // Keys created before 012 have no lookup value yet: fall back to the scan,
  // over those rows only, and fill the value in on a match.
  if (rows.length === 0) {
    rows = await db
      .select({ id: apiKeys.id, orgId: apiKeys.orgId, keyHash: apiKeys.keyHash, keyLookup: apiKeys.keyLookup })
      .from(apiKeys)
      .where(and(live, isNull(apiKeys.keyLookup)));
  }

  const bcrypt = await import('bcryptjs');
  for (const row of rows) {
    if (!row.keyHash) continue;
    if (await bcrypt.default.compare(key, row.keyHash)) {
      try {
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date(), ...(row.keyLookup ? {} : { keyLookup: lookup }) })
          .where(eq(apiKeys.id, row.id));
      } catch {
        /* best effort — a failed touch must not fail the request */
      }
      return row.orgId;
    }
  }
  return null;
}
