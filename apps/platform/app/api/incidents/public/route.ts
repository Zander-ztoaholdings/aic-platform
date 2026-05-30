import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, organizations, incidents, notifications, eq } from '@aic/db';
import { checkRateLimit, getClientIP } from '../../../../lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);
    const { allowed } = checkRateLimit(`incident:${ip}`, 3, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { orgId: providedOrgId, systemName, citizen_email, description } = body;

    if (typeof citizen_email !== 'string' || !EMAIL_RE.test(citizen_email) || citizen_email.length > 254) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }
    if (typeof description !== 'string' || description.trim().length === 0 || description.length > 5000) {
      return NextResponse.json({ error: 'Description is required (max 5000 characters)' }, { status: 400 });
    }

    const safeSysName = typeof systemName === 'string' && systemName.trim() ? systemName.slice(0, 200) : 'Not Specified';

    // 1. Resolve and Validate Organization
    let resolvedOrgId: string | null = null;
    if (typeof providedOrgId === 'string' && providedOrgId.length === 36) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(providedOrgId)) {
            resolvedOrgId = providedOrgId;
        }
    }

    if (!resolvedOrgId) {
        return NextResponse.json({ error: 'Valid Organization UUID is required' }, { status: 400 });
    }

    const tenantDb = getTenantDb(resolvedOrgId);
    const orgExists = await tenantDb.query(async (tx) => {
        const [org] = await tx.select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, resolvedOrgId as string))
            .limit(1);
        return org;
    });

    if (!orgExists) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return await tenantDb.query(async (tx) => {
      // 2. Insert into Incidents table (RLS enforced)
      const [newIncident] = await tx.insert(incidents).values({
        orgId: resolvedOrgId as string,
        citizenEmail: citizen_email,
        systemName: safeSysName,
        description: description,
        status: 'OPEN'
      }).returning({ id: incidents.id });

      // 3. Create Notification for the Organization's Admin
      await tx.insert(notifications).values({
          orgId: resolvedOrgId as string,
          title: 'New Citizen Appeal',
          message: `A new appeal has been lodged by ${citizen_email} regarding ${safeSysName}.`,
          type: 'ALERT'
      });

      return NextResponse.json({
          success: true,
          incidentId: newIncident.id
      });
    });

  } catch (error) {
    console.error('[SECURITY] Public Incident API Error:', error);
    return NextResponse.json({ error: 'Failed to lodge appeal' }, { status: 500 });
  }
}
