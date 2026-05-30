import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, auditLogs, eq, desc, sql, LedgerService } from '@aic/db';
import { getSession } from '../../../lib/auth';
import { enqueueEngineTask } from '@/lib/queue';
import { z } from 'zod';
import type { Session } from 'next-auth';

// Directive A: Zod Schema Validation
const AuditLogSchema = z.object({
  systemName: z.string().min(1).max(255),
  data: z.object({
    protected_attribute: z.string().optional(),
    outcome_variable: z.string().optional(),
    rows: z.array(z.record(z.string(), z.any())).min(1)
  })
});

const AdvancedAuditSchema = z.object({
  systemName: z.string().min(1).max(255),
  type: z.enum(['EQUALIZED_ODDS', 'INTERSECTIONAL']).default('EQUALIZED_ODDS'),
  data: z.object({
    protected_attribute: z.string().optional(),
    protected_attributes: z.array(z.string()).optional(),
    actual_outcome: z.string().optional(),
    predicted_outcome: z.string().optional(),
    outcome_variable: z.string().optional(),
    min_group_size: z.number().optional(),
    rows: z.array(z.record(z.string(), z.any())).min(1)
  })
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Task M13: Institutional RBAC Enforcement
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COMPLIANCE_OFFICER') {
        return NextResponse.json({ error: 'Elevated privileges required to execute audits' }, { status: 403 });
    }

    const orgId = session.user.orgId;
    
    const body = await request.json();
    const validation = AuditLogSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
    }

    const { systemName, data } = validation.data;

    const db = getTenantDb(orgId);
    
    return await db.query(async (tx) => {
      // 1. Fetch last hash for chain (Within Tenant Boundary)
      const [lastLog] = await tx.select({ integrityHash: auditLogs.integrityHash })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);

      const previousHash = lastLog?.integrityHash || null;

      // 2. Create PENDING audit log entry
      const [newLog] = await tx.insert(auditLogs).values({
        orgId,
        systemName,
        eventType: 'BIAS_AUDIT',
        details: { status: 'PENDING_ANALYSIS' },
        status: 'PENDING',
        previousHash
      }).returning({ id: auditLogs.id });

      // 3. Enqueue Async Task
      const jobId = await enqueueEngineTask('disparate_impact', {
        protected_attribute: data.protected_attribute || 'group',
        outcome_variable: data.outcome_variable || 'hired',
        data: data.rows,
        previous_hash: previousHash
      }, newLog.id, orgId);

      // 4. Record to Institutional Ledger
      await LedgerService.append('AUDIT_LOG_CREATED', session.user.id, {
        auditId: newLog.id,
        orgId,
        systemName,
        eventType: 'BIAS_AUDIT'
      });

      return NextResponse.json({ 
        success: true, 
        auditId: newLog.id,
        jobId,
        message: 'Institutional audit analysis enqueued' 
      });
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRITICAL] Audit Engine Integration Error:', message);
    return NextResponse.json({ 
        error: 'Technical validation failed', 
        detail: message 
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
    try {
      const session = await getSession() as Session | null;
      if (!session || !session.user?.orgId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (session.user.role !== 'ADMIN' && session.user.role !== 'COMPLIANCE_OFFICER') {
          return NextResponse.json({ error: 'Elevated privileges required to execute audits' }, { status: 403 });
      }

      const orgId = session.user.orgId;
      
      const body = await request.json();
      const validation = AdvancedAuditSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json({ error: 'Validation failed', details: validation.error.format() }, { status: 400 });
      }

      const { systemName, data, type } = validation.data;
      const db = getTenantDb(orgId);

      return await db.query(async (tx) => {
        const [lastLog] = await tx.select({ integrityHash: auditLogs.integrityHash })
          .from(auditLogs)
          .where(eq(auditLogs.orgId, orgId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(1);

        const previousHash = lastLog?.integrityHash || null;
        const eventType = type === 'EQUALIZED_ODDS' ? 'ADVANCED_BIAS_AUDIT' : 'INTERSECTIONAL_BIAS_AUDIT';

        const [newLog] = await tx.insert(auditLogs).values({
          orgId,
          systemName,
          eventType,
          details: { status: 'PENDING_ANALYSIS' },
          status: 'PENDING',
          previousHash
        }).returning({ id: auditLogs.id });

        const taskType = type === 'EQUALIZED_ODDS' ? 'equalized_odds' : 'intersectional';
        const payload = type === 'EQUALIZED_ODDS' ? {
            protected_attribute: data.protected_attribute || 'group',
            actual_outcome: data.actual_outcome || 'actual',
            predicted_outcome: data.predicted_outcome || 'predicted',
            data: data.rows,
            previous_hash: previousHash
        } : {
            protected_attributes: data.protected_attributes || ['race', 'gender'],
            outcome_variable: data.outcome_variable || 'hired',
            min_group_size: data.min_group_size || 1,
            data: data.rows,
            previous_hash: previousHash
        };

        const jobId = await enqueueEngineTask(taskType, payload, newLog.id, orgId);

        // 4. Record to Institutional Ledger
        await LedgerService.append('AUDIT_LOG_CREATED', session.user.id, {
            auditId: newLog.id,
            orgId,
            systemName,
            eventType
        });

        return NextResponse.json({ success: true, auditId: newLog.id, jobId });
      });
  
    } catch {
      return NextResponse.json({ error: 'Advanced validation failed' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession() as Session | null;
        if (!session || !session.user?.orgId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const orgId = session.user.orgId;

        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');
        const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 100);
        const page = parseInt(searchParams.get('page') || '1');
        const offset = (page - 1) * limit;

        const db = getTenantDb(orgId);

        return await db.query(async (tx) => {
          let whereClause = eq(auditLogs.orgId, orgId);
          if (q) {
            whereClause = sql`${whereClause} AND (${auditLogs.systemName} ILIKE ${`%${q}%`} OR ${auditLogs.eventType} ILIKE ${`%${q}%`})`;
          }

          const logs = await tx.select()
            .from(auditLogs)
            .where(whereClause)
            .orderBy(desc(auditLogs.createdAt))
            .limit(limit)
            .offset(offset);

          const [countResult] = await tx.select({ count: sql`count(*)` })
            .from(auditLogs)
            .where(whereClause);

          const total = parseInt(countResult.count as string);

          return NextResponse.json({ 
              logs,
              pagination: {
                  total,
                  page,
                  limit,
                  pages: Math.ceil(total / limit)
              }
          });
        });
        } catch {
            return NextResponse.json({ error: 'Failed to retrieve logs' }, { status: 500 });
        }
    }
    