import { NextResponse } from 'next/server';
import { getTenantDb, organizations, auditDocuments, eq, desc } from '@aic/db';
import { getSession } from '../../../lib/auth';
import type { Session } from 'next-auth';

const REQUIRED_SLOTS = [
  { type: 'model_card',    label: 'Model Card (ISO Annex B)',  required: true  },
  { type: 'bias_report',   label: 'Bias Audit Report',         required: true  },
  { type: 'data_summary',  label: 'Training Data Summary',     required: true  },
  { type: 'oversight_sop', label: 'Human Oversight SOP',       required: false },
];

export async function GET() {
  const session = await getSession() as Session | null;
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = session.user.orgId;
  const db = getTenantDb(orgId);

  return await db.query(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const docs = await tx
      .select()
      .from(auditDocuments)
      .where(eq(auditDocuments.orgId, orgId))
      .orderBy(desc(auditDocuments.createdAt));

    const uploadedByType = new Set(docs.map(d => d.slotType));

    const slots = REQUIRED_SLOTS.map(slot => ({
      ...slot,
      uploaded: uploadedByType.has(slot.type),
      document: docs.find(d => d.slotType === slot.type) ?? null,
    }));

    const certStep = (() => {
      const s = org.certificationStatus ?? 'DRAFT';
      if (s === 'CERTIFIED') return 3;
      if (s === 'IN_REVIEW' || s === 'UNDER_REVIEW') return 2;
      if (s === 'PENDING_REVIEW') return 1;
      return 0;
    })();

    return NextResponse.json({
      organization: { name: org.name, primaryAiOfficer: org.primaryAiOfficer },
      slots,
      certStep,
      certificationStatus: org.certificationStatus,
    });
  });
}
