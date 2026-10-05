import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSystemDb, auditDocuments, organizations, eq } from '@aic/db';
import { StorageService } from '@aic/db/storage';
import { auth } from '@aic/auth';
import { hasCapability } from '@/lib/rbac';

/**
 * Download one piece of evidence — for the organisation that filed it, or for
 * AIC staff who assess. The file's SHA-256 is recomputed on the way out and
 * compared with the hash taken at upload; the result is sent as
 * X-AIC-Integrity so an assessor knows the file is the one that was filed.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [doc] = await getSystemDb().select().from(auditDocuments).where(eq(auditDocuments.id, id)).limit(1);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ownOrg = !!session?.user?.orgId && session.user.orgId === doc.orgId;
  if (!ownOrg) {
    // Staff: super admins, or the assessor who holds this organisation's file.
    if (!(await hasCapability(userId, 'conduct_assessment'))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!session?.user?.isSuperAdmin && doc.orgId) {
      const [o] = await getSystemDb().select({ a: organizations.auditorId }).from(organizations).where(eq(organizations.id, doc.orgId)).limit(1);
      if (o?.a !== userId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  let buffer: Buffer;
  try {
    buffer = await StorageService.getEvidence(doc.fileUrl);
  } catch {
    return NextResponse.json({ error: 'The file could not be read from storage.' }, { status: 502 });
  }
  const hash = createHash('sha256').update(buffer).digest('hex');
  const integrity = !doc.fileChecksum ? 'unrecorded' : hash === doc.fileChecksum ? 'verified' : 'mismatch';
  if (integrity === 'mismatch') console.error(`[EVIDENCE] integrity mismatch on ${doc.id}`);

  const name = doc.title.replace(/[^\w.\- ]+/g, '_');
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'X-AIC-Integrity': integrity,
      'Cache-Control': 'private, no-store',
    },
  });
}
