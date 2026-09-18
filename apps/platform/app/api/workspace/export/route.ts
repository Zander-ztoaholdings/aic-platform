import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';
import { getModelCardTemplate } from '@/lib/artifact-generator';
import { auth } from '@aic/auth';
import { requireOrgId } from '@/lib/guard';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Checked `session?.user` only, so any authenticated identity — including
  // AIC staff with no organisation — could render an artefact carrying its own
  // name as the responsible person.
  const org = requireOrgId(session.user.orgId);
  if (org instanceof NextResponse) return org;

  try {
    const data = await request.json();
    
    // Add responsible person from session
    const artifactData = {
      ...data,
      responsiblePerson: session.user.name || 'System Auditor'
    };

    const html = getModelCardTemplate(artifactData);
    const pdfBuffer = await generatePDF(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ModelCard-${data.name || 'Export'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Artifact Export Error:', error);
    return NextResponse.json({ error: 'Failed to generate artifact' }, { status: 500 });
  }
}
