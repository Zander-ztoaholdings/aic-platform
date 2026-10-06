import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminActor } from '@/lib/admin';
import { guarded } from '@/lib/registers/caller';
import { autoAssign, autoAssignAllUnassigned } from '@/lib/assignments';

/**
 * Fill empty lead and reviewer seats by the default rule (lib/assignments.ts):
 * one organisation with { orgId }, or every organisation without one. Seats
 * already held are left alone. Each assignment made is logged.
 */
const Body = z.object({
  orgId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const actor = await adminActor('assign_auditors');
  if (!actor) return NextResponse.json({ error: 'Only a super admin, or someone given the right to assign auditors, can change this.' }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'That request was not understood.' }, { status: 400 });
  const { orgId, reason } = parsed.data;
  return guarded('018', async () => {
    const r = orgId ? await autoAssign(orgId, actor.id, reason) : await autoAssignAllUnassigned(actor.id, reason);
    return NextResponse.json({ ok: true, assigned: r.done.length, failed: r.failed });
  });
}
