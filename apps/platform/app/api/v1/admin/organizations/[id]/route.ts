import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, organizations, eq } from '@aic/db';
import { hasCapability } from '@/lib/rbac';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authorized = await hasCapability(session.user.id, 'manage_roles'); // manage_roles is currently used for org management
  if (!authorized) return NextResponse.json({ error: 'Forbidden', message: 'Missing capability: manage_roles' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await request.json();
    const db = getSystemDb();

    // Partial update (Institutional Safety: filter out sensitive fields if necessary)
    const { id: _id, createdAt: _createdAt, ...updateData } = body;

    await db.update(organizations)
      .set({ 
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id));

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
