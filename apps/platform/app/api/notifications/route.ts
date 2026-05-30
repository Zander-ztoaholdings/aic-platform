import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, notifications, eq, and, desc } from '@aic/db';
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
      const result = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.orgId, orgId))
        .orderBy(desc(notifications.createdAt))
        .limit(20);

      return NextResponse.json({ notifications: result });
    });
  } catch (error) {
    console.error('[SECURITY] Notifications GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const { title, message, type } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const db = getTenantDb(orgId);
    return await db.query(async (tx) => {
      await tx.insert(notifications).values({
        orgId,
        title: title ?? 'Client Message',
        message,
        type: type ?? 'CORRESPONDENCE',
        status: 'READ',
      });
      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[SECURITY] Notifications POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;

    const body = await request.json();
    const { id } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      // Multi-tenant check: ensure notification belongs to user's org
      const [updatedNotification] = await tx
        .update(notifications)
        .set({ status: 'READ' })
        .where(and(eq(notifications.id, id), eq(notifications.orgId, orgId)))
        .returning({ id: notifications.id });

      if (!updatedNotification) {
          return NextResponse.json({ error: 'Notification not found or access denied' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[SECURITY] Notifications Update Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
