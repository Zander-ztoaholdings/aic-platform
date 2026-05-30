import { NextResponse } from 'next/server';
import { getSystemDb, incidents, organizations, auditRequirements, notifications, eq, and, lt } from '@aic/db';
import { auth } from '@aic/auth';

export async function POST() {
  try {
    const session = await auth();
    // Task M11: Institutional Escalation - SuperAdmin Only
    if (!session?.user?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // [SECURITY] getSystemDb() used for cross-tenant regulatory escalation. 
    // SuperAdmin privileges are verified before access.
    const db = getSystemDb();
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // 1. Identify incidents older than 72 hours that are still 'OPEN'
    const staleIncidents = await db
      .select({
        id: incidents.id,
        orgId: incidents.orgId,
        citizenEmail: incidents.citizenEmail,
        orgName: organizations.name
      })
      .from(incidents)
      .innerJoin(organizations, eq(incidents.orgId, organizations.id))
      .where(
        and(
          eq(incidents.status, 'OPEN'),
          lt(incidents.createdAt, seventyTwoHoursAgo)
        )
      );

    const results: string[] = [];

    await db.transaction(async (tx) => {
      for (const incident of staleIncidents) {
          // 2. Create a High-Priority Audit Requirement for remediation
          await tx.insert(auditRequirements).values({
              orgId: incident.orgId,
              title: `URGENT: Incident Remediation (${incident.citizenEmail})`,
              description: `Automated escalation: Incident response exceeded 72-hour regulatory threshold. Immediate human review required.`,
              category: 'OVERSIGHT',
              status: 'PENDING'
          });

          // 3. Send Alert Notification
          await tx.insert(notifications).values({
              orgId: incident.orgId,
              title: 'REGULATORY ESCALATION',
              message: `Incident response for ${incident.citizenEmail} has been escalated to Audit Oversight. Integrity Score impact pending.`,
              type: 'ALERT'
          });

          results.push(incident.id);
      }
    });

    return NextResponse.json({ 
        success: true, 
        escalated_count: staleIncidents.length,
        incident_ids: results 
    });

  } catch (error) {
    console.error('[SECURITY] Escalation Job Error:', error);
    return NextResponse.json({ error: 'Failed to process escalations' }, { status: 500 });
  }
}
