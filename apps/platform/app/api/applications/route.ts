import { NextResponse } from 'next/server';
import { getSystemDb, alphaApplications, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  const session = await getSession() as Session | null;
  if (!session?.user || !['ADMIN', 'AUDITOR', 'COMPLIANCE_OFFICER'].includes(session.user.role ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getSystemDb();
  const rows = await db.select().from(alphaApplications).orderBy(desc(alphaApplications.createdAt));

  const applications = rows.map(r => ({
    ...r,
    first_name: r.name?.split(' ')[0] ?? '',
    last_name:  r.name?.split(' ').slice(1).join(' ') ?? '',
    use_case:   r.useCase,
    created_at: r.createdAt,
  }));

  return NextResponse.json({ applications });
}
