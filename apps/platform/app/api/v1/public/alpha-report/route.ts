import { NextRequest, NextResponse } from 'next/server';
import { generatePDF, getReportTemplate } from '@/lib/pdf-generator';

export async function GET(_req: NextRequest) {
  try {
    // Mock data for the Alpha Report (BIZ-1 deliverable)
    const demoData = {
      id: 'REP-ALPHA-2026-001',
      monthYear: 'February 2026',
      orgName: 'Meridian Financial Group',
      orgId: 'ORG-MFG-8842',
      tier: 'Tier 1 (Enterprise)',
      auditStatus: 'COMPLIANT',
      integrityScore: 92,
      findingsCount: 0
    };

    const html = getReportTemplate(demoData);
    const pdfBuffer = await generatePDF(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="AIC-Alpha-Audit-Report.pdf"',
      },
    });

  } catch (error) {
    console.error('[ALPHA_REPORT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to generate alpha report' }, { status: 500 });
  }
}
