import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, organizations, users, eq } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

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
        const userRole = session.user.role;

        if (userRole && userRole !== 'ADMIN' && userRole !== 'COMPLIANCE_OFFICER') {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

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
