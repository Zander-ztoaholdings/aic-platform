import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, leads, eq } from '@aic/db';
import { auth } from '@aic/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin && session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, score, company } = body;

  const db = getSystemDb();

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (score  !== undefined) updates.score  = score;
  if (company !== undefined) updates.company = company;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db.update(leads).set(updates).where(eq(leads.id, id));
  return NextResponse.json({ success: true });
}
