import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, complianceReports, organizations, eq, and } from '@aic/db';
import { getSession } from '../../../../lib/auth';
import { generatePDF, getReportTemplate } from '../../../../lib/pdf-generator';
import type { Session } from 'next-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession() as Session | null;
    if (!session || !session.user?.orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = session.user.orgId;
    const db = getTenantDb(orgId);

    return await db.query(async (tx) => {
      // 1. Fetch report details and ensure it belongs to this org (RLS + manual check)
      const [report] = await tx
        .select({
          id: complianceReports.id,
          orgId: complianceReports.orgId,
          monthYear: complianceReports.monthYear,
          integrityScore: complianceReports.integrityScore,
          findingsCount: complianceReports.findingsCount,
          auditStatus: complianceReports.auditStatus,
          orgName: organizations.name
        })
        .from(complianceReports)
        .innerJoin(organizations, eq(complianceReports.orgId, organizations.id))
        .where(and(eq(complianceReports.id, id), eq(complianceReports.orgId, orgId)))
        .limit(1);

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      const data = {
          id: report.id,
          orgName: report.orgName,
          orgId: report.orgId,
          monthYear: report.monthYear,
          integrityScore: report.integrityScore,
          findingsCount: report.findingsCount,
          auditStatus: report.auditStatus,
          tier: session.user.tier
      };

      // 2. Generate PDF
      const html = getReportTemplate(data);
      const pdfBuffer = await generatePDF(html);

      // 3. Return as PDF download
       
      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="AIC-Report-${report.monthYear.replace(' ', '-')}.pdf"`,
        },
      });
    });

  } catch (error) {
    console.error('[SECURITY] PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF report' }, { status: 500 });
  }
}
