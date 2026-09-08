import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, auditDocuments, auditRequirements, and, eq } from '@aic/db';
import { StorageService } from '@aic/db/storage';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const slotType = formData.get('slotType') as string;
    const requirementId = (formData.get('requirementId') as string) || null;

    if (!file || !slotType) {
      return NextResponse.json({ error: 'Missing file or slot type' }, { status: 400 });
    }

    // If the submission names a requirement, it must be one of this
    // organisation's own — otherwise evidence could be attached to another
    // org's requirement, and the chain would record something untrue.
    if (requirementId) {
      const check = getSystemDb();
      const [req_] = await check
        .select({ id: auditRequirements.id })
        .from(auditRequirements)
        .where(and(
          eq(auditRequirements.id, requirementId),
          eq(auditRequirements.orgId, session.user.orgId)
        ))
        .limit(1);

      if (!req_) {
        return NextResponse.json(
          { error: 'Unknown requirement for this organisation' },
          { status: 400 }
        );
      }
    }

    // 1. Persist to real Storage Backend (Minio/S3)
    const buffer = Buffer.from(await file.arrayBuffer());
    const { evidenceId, hash } = await StorageService.saveEvidence(
      session.user.orgId,
      file.name,
      buffer,
      file.type
    );

    // 2. Register in Database
    const db = getSystemDb();
    const [doc] = await db.insert(auditDocuments).values({
      orgId: session.user.orgId,
      title: file.name,
      slotType,
      fileUrl: evidenceId, 
      fileSize: `${(file.size / 1024).toFixed(2)} KB`,
      fileChecksum: hash,
      uploadedBy: session.user.id,
      status: 'UPLOADED',
      requirementId,
    }).returning();

    // 3. Trigger AI Triage (Async Background Task Placeholder)
    console.log(`[AI FACTORY] Triggering triage for document ${doc.id}`);

    return NextResponse.json({ 
      success: true, 
      document: doc,
      message: 'Document secured in vault. AI Triage initiated.' 
    });

  } catch (error) {
    console.error('[VAULT_UPLOAD_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
