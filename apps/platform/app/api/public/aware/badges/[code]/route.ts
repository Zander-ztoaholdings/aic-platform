import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, awareBadges, eq } from '@aic/db';
import { normaliseBadgeCode, badgeStatus } from '@/lib/aware/badge';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Public verification of one AIC Aware badge, by code.
 *
 * Deliberately narrow: the name the organisation was registered under when the
 * badge was issued, the dates, and whether it is valid, expired or revoked. No
 * score, no answers, no people's names — the verify page answers "is this badge
 * real and current", nothing more. Read with the system pool because the
 * reader is anonymous and the lookup is by an unguessable code, not by tenant.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const ip = getClientIP(request);
  if (!checkRateLimit(`aware-verify:${ip}`, 120).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { code: raw } = await params;
  const code = normaliseBadgeCode(decodeURIComponent(raw));
  if (!code) return NextResponse.json({ error: 'Not a valid badge code.' }, { status: 400 });

  const [badge] = await getSystemDb().select().from(awareBadges).where(eq(awareBadges.code, code)).limit(1);
  if (!badge) {
    return NextResponse.json({ error: 'No badge with this code.' }, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  }

  const status = badgeStatus(badge);
  return NextResponse.json(
    {
      code: badge.code,
      programme: 'AIC Aware',
      selfDeclared: true,
      organisation: badge.orgNameAtIssue,
      status,
      issuedAt: badge.issuedAt,
      expiresAt: badge.expiresAt,
      revokedAt: badge.revokedAt,
      revocationReason: status === 'revoked' ? badge.revocationReason : null,
      accountablePersonNamed: !!badge.accountablePersonId,
      questionSetVersion: badge.questionSetVersion,
      listed: badge.listed && status === 'valid',
    },
    { headers: { 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': '*' } }
  );
}
