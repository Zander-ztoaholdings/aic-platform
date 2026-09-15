import { NextResponse } from 'next/server';
import { getSystemDb, alphaApplications, desc } from '@aic/db';
import { getSession } from '@/lib/auth';
import type { Session } from 'next-auth';

export async function GET() {
  const session = await getSession() as Session | null;
  /* AIC-staff-only gate: was `role !== 'ADMIN'`, which is the same field a client org's own admin holds - see lib/roles.ts's file header and the AIMS route comment for why that's a bug class, already fixed once elsewhere. Checks isSuperAdmin as well so this can't newly lock out anyone who already passes other isSuperAdmin-gated checks. */
  if (!session?.user || !(['AIC_SUPER_ADMIN', 'AIC_AUDITOR'].includes(session.user.role ?? '') || session.user.isSuperAdmin)) {
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
