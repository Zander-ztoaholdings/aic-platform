import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, auditDocuments, auditRequirements, and, eq } from '@aic/db';
import { StorageService, storageConfig } from '@aic/db/storage';
import { canManageCompliance } from '@/lib/roles';
import { CONTROL_SLOT_PREFIX, controlFromSlot, COMMON_BY_KEY } from '@/lib/common-controls';
import { triageDocument } from '@/lib/ai/triage';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageCompliance(session.user.role as string | undefined)) {
    return NextResponse.json({ error: 'Your role does not allow submitting evidence.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const slotType = formData.get('slotType') as string;
    const requirementId = (formData.get('requirementId') as string) || null;

    if (!file || !slotType) {
      return NextResponse.json({ error: 'Missing file or slot type' }, { status: 400 });
    }
    // Evidence for a common control (Controls page) names the control in its
    // slot type. It must be one AIC knows, or it would count for nothing.
    if (slotType.startsWith(CONTROL_SLOT_PREFIX) && !controlFromSlot(slotType)) {
      return NextResponse.json({ error: 'Unknown control' }, { status: 400 });
    }

    // If the submission names a requirement, it must be one of this
    // organisation's own — otherwise evidence could be attached to another
    // org's requirement, and the chain would record something untrue.
    let purpose = slotType;
    let guidance: string | null = null;
    const controlKey = controlFromSlot(slotType);
    if (controlKey) { purpose = `the control "${COMMON_BY_KEY[controlKey].title}"`; guidance = COMMON_BY_KEY[controlKey].evidence; }
    if (requirementId) {
      const check = getSystemDb();
      const [req_] = await check
        .select({ id: auditRequirements.id, code: auditRequirements.code, title: auditRequirements.title, guidance: auditRequirements.evidenceGuidance })
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
      purpose = `requirement ${req_.code ?? ''} of the AIC standard: ${req_.title}`.trim();
      guidance = req_.guidance ?? null;
    }

    // 1. Persist to the evidence bucket (MinIO or any S3-compatible store)
    if (!storageConfig()) {
      console.error('[VAULT_UPLOAD] evidence storage is not configured (MINIO_* variables)');
      return NextResponse.json(
        { error: 'File storage is not switched on for this AIC server yet, so the file was not saved. AIC has been alerted.' },
        { status: 503 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let evidenceId: string, hash: string;
    try {
      ({ evidenceId, hash } = await StorageService.saveEvidence(session.user.orgId, file.name, buffer, file.type));
    } catch (e) {
      console.error('[VAULT_UPLOAD] storage write failed:', e);
      return NextResponse.json({ error: 'The file could not be stored. Nothing was saved; please try again.' }, { status: 502 });
    }

    // 2. A first read by AIC's model, when configured, so the person filing
    // learns straight away if the file is not what is asked for. Never blocks
    // the upload and never sets the document's status.
    const triage = await triageDocument({ fileName: file.name, buf: buffer, purpose, guidance });

    // 3. Register in Database
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
      aiTriageNotes: triage ? JSON.stringify(triage) : null,
    }).returning();

    return NextResponse.json({ 
      success: true, 
      document: doc,
      triage,
      message: 'Evidence received. An AIC assessor will review it.' 
    });

  } catch (error) {
    console.error('[VAULT_UPLOAD_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
