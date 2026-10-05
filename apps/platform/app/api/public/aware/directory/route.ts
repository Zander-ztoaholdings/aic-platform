import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, awareBadges, and, eq, isNull, asc, sql } from '@aic/db';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * The public AIC Aware directory: badges that are current, not revoked, and
 * whose organisation chose to be listed. Names as registered at issue, codes
 * for verification, dates. No scores — the directory records who has declared,
 * not how well.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  if (!(await checkRateLimit(`aware-directory:${ip}`, 60)).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const rows = await getSystemDb()
    .select({
      code: awareBadges.code,
      organisation: awareBadges.orgNameAtIssue,
      issuedAt: awareBadges.issuedAt,
      expiresAt: awareBadges.expiresAt,
    })
    .from(awareBadges)
    .where(and(eq(awareBadges.listed, true), isNull(awareBadges.revokedAt), sql`${awareBadges.expiresAt} > now()`))
    .orderBy(asc(awareBadges.orgNameAtIssue))
    .limit(1000);

  return NextResponse.json(
    { entries: rows, count: rows.length },
    { headers: { 'Cache-Control': 'public, max-age=120', 'Access-Control-Allow-Origin': '*' } }
  );
}
