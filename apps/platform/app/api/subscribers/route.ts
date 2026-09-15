import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, newsletterSubscribers, desc } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

/** The citizen newsletter list (app/(modules)/hq/subscribers - "The Pulse Community"). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_content');
  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_content' }, { status: 403 });
  }

  try {
    const db = getSystemDb();
    const rows = await db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        status: newsletterSubscribers.status,
        subscribed_at: newsletterSubscribers.subscribedAt,
      })
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.subscribedAt));

    return NextResponse.json({ subscribers: rows });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}
