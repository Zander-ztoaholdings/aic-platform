import { NextResponse } from 'next/server';
import { generatePDF } from '../../../../lib/pdf-generator';
import { getCertificateTemplate } from '../../../../lib/artifact-generator';
import { auth } from '@aic/auth';
import QRCode from 'qrcode';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Prepare Certificate Data
    const certData = {
      name: session.user.name || 'System Practitioner',
      level: session.user.role === 'ADMIN' ? 'LEVEL 3 CHIEF ETHICS OFFICER' : 'LEVEL 2 SENIOR AUDITOR',
      licenseNumber: `AIC-ZA-2026-${session.user.id.substring(0, 4).toUpperCase()}`,
      validUntil: 'DEC 31, 2026'
    };

    // 2. Generate Verification QR Code
    const verificationUrl = `${process.env.NEXTAUTH_URL}/verify/${certData.licenseNumber}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // 3. Generate PDF
    const html = getCertificateTemplate({ ...certData, qrCodeDataUrl });
    const pdfBuffer = await generatePDF(html);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AIC-Certificate-${session.user.name}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Certificate Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 });
  }
}
