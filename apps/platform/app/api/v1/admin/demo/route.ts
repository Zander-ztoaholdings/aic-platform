import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getSystemDb, organizations, eq } from '@aic/db';
import { adminActor, recordAdminAction } from '@/lib/admin';
import { seedHighveld, removeHighveld, DEMO_ORG_ID, DEMO_TRUST_SLUG } from '@/lib/demo/highveld';

export const maxDuration = 120;

/** Whether the demo company exists. Super admins only. */
export async function GET() {
  const actor = await adminActor('manage_users');
  if (!actor?.isSuperAdmin) return NextResponse.json({ error: 'Super admins only.' }, { status: 403 });
  const [org] = await getSystemDb().select({ createdAt: organizations.createdAt }).from(organizations).where(eq(organizations.id, DEMO_ORG_ID)).limit(1);
  return NextResponse.json({ exists: !!org, trustSlug: DEMO_TRUST_SLUG });
}

/** Build, or rebuild from scratch, Highveld Credit (Demo). Returns the sign-in details once. */
export async function POST() {
  const actor = await adminActor('manage_users');
  if (!actor?.isSuperAdmin) return NextResponse.json({ error: 'Super admins only.' }, { status: 403 });
  try {
    const r = await seedHighveld();
    await recordAdminAction({ actorId: actor.id, orgId: DEMO_ORG_ID, targetType: 'ADMIN_ORG', targetId: DEMO_ORG_ID, previous: null, next: { demo: 'rebuilt', ...r.summary }, reason: 'Demo company rebuilt' });
    return NextResponse.json({ ...r, qr: await QRCode.toDataURL(r.credentials.otpauth) });
  } catch (e) {
    console.error('[DEMO] seed failed:', e);
    return NextResponse.json({ error: `The demo company could not be built: ${(e as Error).message}` }, { status: 500 });
  }
}

/** Remove the demo company. */
export async function DELETE() {
  const actor = await adminActor('manage_users');
  if (!actor?.isSuperAdmin) return NextResponse.json({ error: 'Super admins only.' }, { status: 403 });
  await removeHighveld();
  return NextResponse.json({ ok: true });
}
