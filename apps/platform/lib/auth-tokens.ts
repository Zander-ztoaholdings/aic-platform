import crypto from 'node:crypto';
import { getSystemDb, passwordResetTokens, and, eq } from '@aic/db';

/**
 * One-time tokens for invites, password resets and email verification. They
 * share password_reset_tokens (no purpose column yet), so every purpose
 * already implies control of the mailbox the link was sent to.
 */
export const TOKEN_TTL = {
  reset: 60 * 60 * 1000,
  verify: 48 * 60 * 60 * 1000,
  invite: 7 * 24 * 60 * 60 * 1000,
} as const;

export async function issueToken(userId: string, ttlMs: number, { revokePrevious = true } = {}): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const db = getSystemDb();
  await db.transaction(async (tx) => {
    if (revokePrevious) {
      await tx
        .update(passwordResetTokens)
        .set({ used: true })
        .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.used, false)));
    }
    await tx.insert(passwordResetTokens).values({ userId, token, expiresAt: new Date(Date.now() + ttlMs) });
  });
  return token;
}
