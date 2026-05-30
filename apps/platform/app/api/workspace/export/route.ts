import { NextRequest, NextResponse } from 'next/server';
import { generatePDF } from '@/lib/pdf-generator';
import { getModelCardTemplate } from '@/lib/artifact-generator';
import { auth } from '@aic/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
