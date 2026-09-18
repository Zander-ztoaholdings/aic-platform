import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, organizations, users, eq } from '@aic/db';
import { getSession } from '@/lib/auth';
import type { Session } from 'next-auth';
import { requireOrgCapability } from '@/lib/guard';
import { canEditOrgProfile } from '@/lib/roles';

export async function GET() {
    try {
        const session = await getSession() as Session | null;
        if (!session || !session.user?.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const orgId = session.user.orgId;
        const db = getTenantDb(orgId);

        return await db.query(async (tx) => {
          const [result] = await tx
              .select({ 
                id: organizations.id, 
                name: organizations.name, 
                tier: organizations.tier, 
                integrityScore: organizations.integrityScore, 
                isAlpha: organizations.isAlpha, 
                createdAt: organizations.createdAt,
                contactEmail: users.email,
                contactName: users.name,
                twoFactorEnabled: users.twoFactorEnabled
              })
              .from(organizations)
              .leftJoin(users, eq(users.id, session.user?.id as string))
              .where(eq(organizations.id, orgId))
              .limit(1);

          if (!result) {
              return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
          }

          return NextResponse.json(result);
        });
    } catch (error) {
        console.error('[SECURITY] Settings GET Error:', error);
        return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession() as Session | null;
        if (!session || !session.user?.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const orgId = session.user.orgId;

        // Was: `if (userRole && userRole !== 'ORG_ADMIN' && ...)`. The leading
        // truthiness test meant a session carrying no role at all skipped the
        // check entirely and edited the organisation profile — the one case
        // most worth refusing. canEditOrgProfile fails closed on null.
        const refusal = requireOrgCapability(
            session?.user?.role,
            canEditOrgProfile,
            'edit the organisation profile'
        );
        if (refusal) return refusal;

        const body = await request.json();
        const { name } = body;

        const db = getTenantDb(orgId);

        return await db.query(async (tx) => {
          if (name !== undefined) {
              if (typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
                  return NextResponse.json({ error: 'Invalid organization name' }, { status: 400 });
              }

              await tx
                  .update(organizations)
                  .set({ name: name.trim() })
                  .where(eq(organizations.id, orgId));
          }

          // Return updated settings
          const [result] = await tx
              .select({ 
                id: organizations.id, 
                name: organizations.name, 
                tier: organizations.tier, 
                integrityScore: organizations.integrityScore, 
                isAlpha: organizations.isAlpha, 
                createdAt: organizations.createdAt,
                contactEmail: users.email,
                contactName: users.name,
                twoFactorEnabled: users.twoFactorEnabled
              })
              .from(organizations)
              .leftJoin(users, eq(users.id, session.user?.id as string))
              .where(eq(organizations.id, orgId))
              .limit(1);

          return NextResponse.json(result);
        });
    } catch (error) {
        console.error('[SECURITY] Settings PATCH Error:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
