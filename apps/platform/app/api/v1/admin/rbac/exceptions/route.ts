import { NextRequest, NextResponse } from 'next/server';
import { superAdminCaller, setOverride, clearOverride } from '@/lib/rbac-admin';

/**
 * Add or remove a per-person exception. Body: { userId, capability, effect: 'grant' | 'deny', reason }
 * to add; { userId, capability, reason } on DELETE to remove. Every change is logged with its reason.
 */
export async function POST(request: NextRequest) {
  const me = await superAdminCaller();
  if (!me) return NextResponse.json({ error: 'Only a super admin can change permissions.' }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { userId?: unknown; capability?: unknown; effect?: unknown; reason?: unknown };
  if (typeof b.userId !== 'string' || typeof b.capability !== 'string' || (b.effect !== 'grant' && b.effect !== 'deny')) {
    return NextResponse.json({ error: 'Choose a person, a capability and whether to grant or deny it.' }, { status: 400 });
  }
  const r = await setOverride(me.id, b.userId, b.capability, b.effect, typeof b.reason === 'string' ? b.reason : '');
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}

export async function DELETE(request: NextRequest) {
  const me = await superAdminCaller();
  if (!me) return NextResponse.json({ error: 'Only a super admin can change permissions.' }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { userId?: unknown; capability?: unknown; reason?: unknown };
  if (typeof b.userId !== 'string' || typeof b.capability !== 'string') return NextResponse.json({ error: 'Choose the exception to remove.' }, { status: 400 });
  const r = await clearOverride(me.id, b.userId, b.capability, typeof b.reason === 'string' ? b.reason : '');
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
