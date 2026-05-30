import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, getSystemDb, aimsAssessments, conflictChecks, organizations, eq, sql } from '@aic/db';
import { auth } from '@aic/auth';
import { z } from 'zod';
import { isValidTransition } from '@/lib/state-machine';

const TransitionSchema = z.object({
  stage: z.enum(['ADVISORY', 'READINESS', 'STAGE_1_DOCS', 'STAGE_2_TECHNICAL', 'CERTIFIED', 'SUSPENDED']),
  notes: z.string().optional(),
});

const ConflictCheckSchema = z.object({
  auditorId: z.string().uuid(),
  hasPriorAdvisoryRelationship: z.boolean(),
  lastAdvisoryDate: z.string().optional().nullable(),
  justification: z.string().optional(),
});

// GET /api/v1/aims/:orgId - Get AIMS status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Regular users can only see their own org
    if (session.user.role !== 'ADMIN' && session.user.role !== 'AUDITOR' && session.user.orgId !== orgId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const sysDb = getSystemDb();
    const [assessment] = await sysDb.select().from(aimsAssessments).where(eq(aimsAssessments.orgId, orgId)).limit(1);

    if (!assessment) {
      // Only Auditors or Admins can initialize a new assessment
      if (session.user.role !== 'AUDITOR' && session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'AIMS assessment not initialized. Contact an auditor.' }, { status: 404 });
      }
      
      const [newAssessment] = await sysDb.insert(aimsAssessments).values({ orgId }).returning();
      return NextResponse.json(newAssessment);
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error('[AIMS] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch AIMS assessment' }, { status: 500 });
  }
}

// POST /api/v1/aims/:orgId/transition - Progress through stages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await auth();
    if (!session?.user || (session.user.role !== 'AUDITOR' && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Auditor privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { stage, notes } = TransitionSchema.parse(body);

    const db = getTenantDb(session.user.orgId as string);

    return await db.transaction(async (tx) => {
        // 1. Fetch current assessment to verify transition
        const [assessment] = await tx.select().from(aimsAssessments).where(eq(aimsAssessments.orgId, orgId)).limit(1);
        
        if (assessment && !isValidTransition(assessment.stage as any, stage)) {
            return NextResponse.json({ 
                error: 'Invalid Stage Transition', 
                message: `Cannot move from ${assessment.stage} to ${stage}` 
            }, { status: 400 });
        }

        // 2. Verify Impartiality before moving beyond READINESS
        if (['STAGE_1_DOCS', 'STAGE_2_TECHNICAL', 'CERTIFIED'].includes(stage)) {
          if (!assessment?.impartialityDisclosureSigned) {
            return NextResponse.json({ 
              error: 'Forbidden: Impartiality Disclosure (ISO 17021/42001) must be signed before proceeding to audit stages.' 
            }, { status: 403 });
          }
        }

        const [updated] = await tx.update(aimsAssessments)
          .set({ 
            stage, 
            notes: notes ? sql`${aimsAssessments.notes} || '\n' || ${notes}` : aimsAssessments.notes,
            updatedAt: new Date()
          })
          .where(eq(aimsAssessments.orgId, orgId))
          .returning();

        // [SECURITY] Record High-Stakes Stage Transition in HITL Logs
        const { hitlLogs } = await import('@aic/db');
        await tx.insert(hitlLogs).values({
            actorId: session.user.id,
            targetType: 'AIMS_STAGE_TRANSITION',
            targetId: orgId,
            previousValue: { stage: assessment?.stage },
            newValue: { stage, notes },
            overrideReason: 'Formal certification stage progression.'
        });

        // If Certified, update organization status
        if (stage === 'CERTIFIED') {
          const sysDb = getSystemDb();
          await sysDb.update(organizations)
            .set({ certificationStatus: 'CERTIFIED', accreditationStatus: 'ACTIVE' })
            .where(eq(organizations.id, orgId));
        }

        return NextResponse.json(updated);
    });
  } catch (error) {
    console.error('[AIMS_TRANSITION_ERROR]', error);
    return NextResponse.json({ error: 'Transition failed' }, { status: 400 });
  }
}

// POST /api/v1/aims/:orgId/conflict-check - Formal Impartiality Check
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await auth();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'SuperAdmin required for conflict clearing' }, { status: 403 });
    }

    const body = await request.json();
    const data = ConflictCheckSchema.parse(body);

    // [INTEGRITY CHECK] TWO-YEAR CONFLICT RULE
    // ISO/IEC 42001 requires auditors have no advisory relationship for 2 years.
    let isCleared = true;
    if (data.hasPriorAdvisoryRelationship && data.lastAdvisoryDate) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const lastAdvisory = new Date(data.lastAdvisoryDate);
      
      if (lastAdvisory > twoYearsAgo) {
        isCleared = false;
      }
    }

    const db = getSystemDb();
    const [check] = await db.insert(conflictChecks).values({
      auditorId: data.auditorId,
      orgId,
      hasPriorAdvisoryRelationship: data.hasPriorAdvisoryRelationship,
      lastAdvisoryDate: data.lastAdvisoryDate ? new Date(data.lastAdvisoryDate) : null,
      isCleared,
      justification: data.justification
    }).returning();

    if (isCleared) {
      await db.update(aimsAssessments)
        .set({ 
          assignedAuditorId: data.auditorId,
          impartialityDisclosureSigned: true,
          impartialitySignedAt: new Date()
        })
        .where(eq(aimsAssessments.orgId, orgId));
    }

    return NextResponse.json({ 
      check, 
      message: isCleared ? 'Auditor cleared and assigned.' : 'CONFLICT DETECTED: Two-year cooling-off period not met.' 
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Conflict check failed' }, { status: 400 });
  }
}
