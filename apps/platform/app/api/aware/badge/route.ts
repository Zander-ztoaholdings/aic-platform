import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getTenantDb, awareBadges, and, eq, isNull } from '@aic/db';
import { canEditOrgProfile } from '@/lib/roles';

/** Opt the organisation's current badge in or out of the public directory. Body: { listed: boolean } */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  const orgId = session?.user?.orgId as string | undefined;
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canEditOrgProfile(session!.user.role as string | undefined)) {
    return NextResponse.json({ error: 'Your role does not allow changing the directory listing.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { listed?: unknown };
  if (typeof body.listed !== 'boolean') {
    return NextResponse.json({ error: 'listed must be true or false.' }, { status: 400 });
  }

  const [badge] = await getTenantDb(orgId).query((tx) =>
    tx
      .update(awareBadges)
      .set({ listed: body.listed as boolean })
      .where(and(eq(awareBadges.orgId, orgId), isNull(awareBadges.revokedAt)))
      .returning({ code: awareBadges.code, listed: awareBadges.listed })
  );

  if (!badge) return NextResponse.json({ error: 'There is no current badge to list.' }, { status: 404 });
  return NextResponse.json(badge);
}
