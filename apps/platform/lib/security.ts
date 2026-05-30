import { getSystemDb, revokedTokens, loginAttempts, users, eq, and, sql } from '@aic/db';

/**
 * Checks if a JWT ID (JTI) has been revoked (logged out).
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const db = getSystemDb();
  const [revoked] = await db
    .select()
    .from(revokedTokens)
    .where(eq(revokedTokens.jti, jti))
    .limit(1);
  
  return !!revoked;
}

/**
 * Records a login attempt and checks for account lockout.
 */
export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  const db = getSystemDb();
  
  await db.insert(loginAttempts).values({
    email,
    ipAddress: ip,
    success
  });

  if (!success) {
    // Check recent failures
    const recentFailures = await db
      .select()
      .from(loginAttempts)
      .where(and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        sql`created_at > now() - interval '15 minutes'`
      ));

    if (recentFailures.length >= 5) {
      const lockoutTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      await db.update(users)
        .set({ lockoutUntil: lockoutTime })
        .where(eq(users.email, email));
      return { locked: true, until: lockoutTime };
    }
  } else {
    // Reset on success
    await db.update(users)
      .set({ lockoutUntil: null })
      .where(eq(users.email, email));
  }
  
  return { locked: false };
}

/**
 * Checks if an account is currently locked.
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const db = getSystemDb();
  const [user] = await db
    .select({ lockoutUntil: users.lockoutUntil })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user?.lockoutUntil && user.lockoutUntil > new Date()) {
    return true;
  }
  return false;
}
