import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, auditDocuments, eq } from '@aic/db';
import { auth } from '@aic/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: 'Requires Super Admin (God Mode)' }, { status: 403 });
  }

  const { documentId } = await req.json();
  const db = getSystemDb();

  // Autonomous Factory Logic: Mocking OCR + LLM Analysis
  const triageNotes = "Automated AI Scan: Page 4 contains incomplete signature fields. Model risk identified as 'High' due to sensitive demographic training data.";
  const extractedData = {
    modelName: "Alpha-Credit-Scoring-v2",
    lastTrained: "2026-01-15",
    riskProfile: "High"
  };

  await db.update(auditDocuments)
    .set({
      status: 'AI_TRIAGED',
      aiTriageNotes: triageNotes,
      ocrExtractedData: extractedData,
      riskScore: 85
    })
    .where(eq(auditDocuments.id, documentId));

  return NextResponse.json({ success: true, triageNotes });
}
