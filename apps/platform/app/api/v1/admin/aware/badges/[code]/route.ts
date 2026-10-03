import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, awareBadges, hitlLogs, eq } from '@aic/db';
import { z } from 'zod';
import { hasCapability } from '@/lib/rbac';
import { normaliseBadgeCode } from '@/lib/aware/badge';

const Body = z.object({
  action: z.literal('REVOKE'),
  reason: z.string().trim().min(10, 'Give a reason of at least 10 characters.').max(2000),
});

/**
 * AIC revokes an AIC Aware badge.
 *
 * Until now a badge could only be replaced by its own organisation submitting
 * again. AIC had no way to withdraw one it found to be misleading — a badge
 * used outside its rules, a declaration shown to be untrue, an organisation
 * that asked for removal. Revocation is terminal: the badge's registry entry
 * and every embedded copy of it show "Revoked" with the reason from here on.
 *
 * Same capability as certificate suspension and revocation: deciding that a
 * public mark no longer stands is a certification-lifecycle decision, not
 * evaluation work.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const actor = session?.user?.id as string | undefined;
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasCapability(actor, 'manage_certification_lifecycle'))) {
    return NextResponse.json({ error: 'Only someone who can decide certification outcomes may revoke a badge.' }, { status: 403 });
  }

  const { code: raw } = await params;
  const code = normaliseBadgeCode(decodeURIComponent(raw));
  if (!code) return NextResponse.json({ error: 'Not a valid badge code.' }, { status: 400 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  }

  const now = new Date();
  const result = await getSystemDb().transaction(async (tx) => {
    const [badge] = await tx.select().from(awareBadges).where(eq(awareBadges.code, code)).limit(1);
    if (!badge) return { status: 404 as const, body: { error: 'No badge with this code.' } };
    if (badge.revokedAt) return { status: 409 as const, body: { error: 'This badge is already revoked.' } };

    const [updated] = await tx
      .update(awareBadges)
      .set({ revokedAt: now, revokedBy: actor, revocationReason: parsed.data.reason, listed: false })
      .where(eq(awareBadges.id, badge.id))
      .returning({ code: awareBadges.code, revokedAt: awareBadges.revokedAt });

    await tx.insert(hitlLogs).values({
      orgId: badge.orgId,
      actorId: actor,
      targetType: 'AWARE_BADGE',
      targetId: badge.id,
      previousValue: { status: 'active', listed: badge.listed },
      newValue: { status: 'revoked', code: badge.code },
      overrideReason: parsed.data.reason,
    });

    return { status: 200 as const, body: updated };
  });

  return NextResponse.json(result.body, { status: result.status });
}
