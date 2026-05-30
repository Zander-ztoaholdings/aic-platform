import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, practitionerCertifications, cpdLogs, eq, and, sql } from '@aic/db';
import { auth } from '@aic/auth';
import { z } from 'zod';

const CPDLogSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  hours: z.number().min(0.5),
  category: z.enum(['TRAINING', 'AUDIT_LEAD', 'RESEARCH']),
  evidenceUrl: z.string().url().optional(),
});

// GET /api/v1/practitioner - Get current user's professional status
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getTenantDb(session.user.orgId as string);
    
    return await db.transaction(async (tx) => {
      const [certification] = await tx.select().from(practitionerCertifications)
          .where(eq(practitionerCertifications.userId, session.user.id))
          .limit(1);

      const logs = await tx.select().from(cpdLogs)
          .where(eq(cpdLogs.userId, session.user.id));

      const [stats] = await tx.select({
          totalHours: sql<number>`sum(hours)`
      }).from(cpdLogs).where(and(eq(cpdLogs.userId, session.user.id), eq(cpdLogs.status, 'APPROVED')));

      return NextResponse.json({
        certification,
        cpd: {
          logs,
          totalHours: Number(stats?.totalHours) || 0,
          requiredHours: 40, // ISO 17024 standard for AIC
        }
      });
    });
  } catch (_error) {
    console.error('[PRACTITIONER_API] Error:', _error);
    return NextResponse.json({ error: 'Failed to fetch practitioner data' }, { status: 500 });
  }
}

// POST /api/v1/practitioner/cpd - Log professional development
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = CPDLogSchema.parse(body);

    const db = getTenantDb(session.user.orgId as string);
    return await db.transaction(async (tx) => {
      const [newLog] = await tx.insert(cpdLogs).values({
        userId: session.user.id,
        ...data,
        status: 'PENDING',
        date: new Date()
      }).returning();

      return NextResponse.json(newLog);
    });
  } catch (_error) {
    console.error('[PRACTITIONER_CPD_API] Error:', _error);
    return NextResponse.json({ error: 'Failed to log CPD' }, { status: 400 });
  }
}
