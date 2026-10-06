import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, suppliers, supplierDocumentReads, auditDocuments, and, eq, desc } from '@aic/db';
import { StorageService, storageConfig } from '@aic/db/storage';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { isUuid } from '@/lib/policy-hash';
import { extractSupplierText, readSupplierDocument, MAX_UPLOAD_BYTES, ACCEPTED_EXT } from '@/lib/ai/supplier-doc';

type Ctx = { params: Promise<{ id: string }> };

/** The documents read for one supplier, newest first. */
export async function GET(_r: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller();
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return guarded('017', async () => {
    const reads = await getTenantDb(c.orgId).query((tx) =>
      tx.select().from(supplierDocumentReads).where(and(eq(supplierDocumentReads.orgId, c.orgId), eq(supplierDocumentReads.supplierId, id))).orderBy(desc(supplierDocumentReads.createdAt)));
    return NextResponse.json({ reads });
  });
}

/**
 * Upload a supplier's security document. The file is kept with the
 * organisation's evidence (slot SUPPLIER:<id>) and AIC gives it a first read
 * that pre-fills the review. The read is a suggestion; a person records the
 * outcome.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'The file is over 20 MB.' }, { status: 400 });
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!(ACCEPTED_EXT as readonly string[]).includes(ext)) return NextResponse.json({ error: 'Upload a PDF, Word (.docx), text or Markdown file.' }, { status: 400 });

  return guarded('017', async () => {
    const db = getTenantDb(c.orgId);
    const [s] = await db.query((tx) => tx.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.orgId, c.orgId))).limit(1));
    if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const buf = Buffer.from(await file.arrayBuffer());
    const extracted = extractSupplierText(file.name, buf);
    if ('error' in extracted) return NextResponse.json({ error: extracted.error }, { status: 400 });

    // Keep the file with the organisation's evidence when storage is on.
    let documentId: string | null = null;
    let keptNote: string | null = null;
    if (storageConfig()) {
      try {
        const { evidenceId, hash } = await StorageService.saveEvidence(c.orgId, file.name, buf, file.type);
        const [doc] = await db.query((tx) => tx.insert(auditDocuments).values({
          orgId: c.orgId, title: file.name, slotType: `SUPPLIER:${id}`, fileUrl: evidenceId,
          fileSize: `${(file.size / 1024).toFixed(2)} KB`, fileChecksum: hash, uploadedBy: c.userId, status: 'UPLOADED',
        }).returning({ id: auditDocuments.id }));
        documentId = doc.id;
      } catch (e) {
        console.error('[SUPPLIER_DOC] storage write failed:', (e as Error).message);
        keptNote = 'The file itself could not be stored, so only this read was kept.';
      }
    } else {
      keptNote = 'File storage is not switched on for this AIC server, so only this read was kept, not the file.';
    }

    const { findings, readBy } = await readSupplierDocument({
      text: 'text' in extracted ? extracted.text : '', pdf: 'pdf' in extracted ? extracted.pdf : undefined, fileName: file.name,
      supplier: { name: s.name, purpose: s.purpose, outsideSa: s.outsideSa, hasDpa: s.hasDpa, dataShared: s.dataShared },
    });
    const withNote = keptNote ? { ...findings, readNote: [findings.readNote, keptNote].filter(Boolean).join(' ') } : findings;
    const [row] = await db.query((tx) => tx.insert(supplierDocumentReads).values({
      orgId: c.orgId, supplierId: id, documentId, fileName: file.name.slice(0, 255), findings: withNote, readBy, createdBy: c.userId,
    }).returning());
    return NextResponse.json({ read: row }, { status: 201 });
  });
}
