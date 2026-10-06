import { NextRequest, NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';
import { z } from 'zod';
import { adminActor } from '@/lib/admin';
import { hasCapability } from '@/lib/rbac';
import { guarded } from '@/lib/registers/caller';
import {
  ROLES, MIN_REASON, canBeDefault, canHold, computeLoad, currentAssignments, staffMembers, conflictsByOrg,
  waitingByOrg, assignmentHistory, assign, unassign, loadScore,
} from '@/lib/assignments';

/**
 * Who leads and reviews each organisation (app/(modules)/admin/assignments).
 *
 * Reading is for anyone who can see the register. Changing an assignment
 * needs assign_auditors (super admins, or a per-user grant); every change is
 * written to org_assignments and to the oversight record (hitl_logs).
 */
export async function GET(request: NextRequest) {
  const actor = await adminActor('view_all_orgs');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // ?historyFor=<orgId>: one organisation's assignment history, newest first.
  const historyFor = request.nextUrl.searchParams.get('historyFor');
  if (historyFor) {
    if (!/^[0-9a-f-]{36}$/i.test(historyFor)) return NextResponse.json({ error: 'No such organisation.' }, { status: 404 });
    return guarded('018', async () => NextResponse.json({ history: await assignmentHistory(historyFor, 50) }));
  }
  return guarded('018', async () => {
    const canAssign = await hasCapability(actor.id, 'assign_auditors');
    const [orgs, current, staff, conflicts, waiting, history] = await Promise.all([
      getSystemDb().execute(sql`
        SELECT id, name, division, sector, certification_status AS "certificationStatus", created_at AS "createdAt"
        FROM organizations ORDER BY name`),
      currentAssignments(), staffMembers(), conflictsByOrg(), waitingByOrg(), assignmentHistory(undefined, 60),
    ]);
    const load = computeLoad(current, waiting);
    const organisations = (orgs.rows as { id: string; name: string }[]).map((o) => {
      const mine = current.filter((a) => a.orgId === o.id);
      const seat = (role: string) => { const a = mine.find((x) => x.role === role); return a ? { id: a.userId, name: a.userName, since: a.assignedAt, reason: a.reason } : null; };
      return {
        ...o,
        waiting: waiting.get(o.id) ?? 0,
        lead: seat('lead'),
        reviewer: seat('reviewer'),
        // Who may not be assigned here. Only shown to people who assign.
        conflicted: canAssign ? [...(conflicts.get(o.id) ?? [])] : [],
      };
    });
    return NextResponse.json({
      me: actor.id,
      canAssign,
      organisations,
      unassigned: organisations.filter((o) => !o.lead).length,
      staff: staff.filter(canHold).map((m) => {
        const l = load.get(m.id) ?? { leads: 0, reviews: 0, waiting: 0 };
        return { id: m.id, name: m.name, email: m.email, role: m.role, isSuperAdmin: !!m.isSuperAdmin, byDefault: canBeDefault(m), ...l, score: loadScore(l) };
      }),
      history,
    });
  });
}

const Assign = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(ROLES),
  reason: z.string().trim().min(MIN_REASON).max(1000),
});

export async function POST(request: NextRequest) {
  const actor = await adminActor('assign_auditors');
  if (!actor) return NextResponse.json({ error: 'Only a super admin, or someone given the right to assign auditors, can change this.' }, { status: 403 });
  const parsed = Assign.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Choose an organisation, a person and a seat, and give a short reason.' }, { status: 400 });
  const b = parsed.data;
  return guarded('018', async () => {
    const r = await assign(b.orgId, b.userId, b.role, actor.id, b.reason);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  });
}

const End = z.object({
  orgId: z.string().uuid(),
  role: z.enum(ROLES),
  reason: z.string().trim().min(MIN_REASON).max(1000),
});

export async function DELETE(request: NextRequest) {
  const actor = await adminActor('assign_auditors');
  if (!actor) return NextResponse.json({ error: 'Only a super admin, or someone given the right to assign auditors, can change this.' }, { status: 403 });
  const q = request.nextUrl.searchParams;
  const body = await request.json().catch(() => ({}));
  const parsed = End.safeParse({ orgId: q.get('orgId') ?? undefined, role: q.get('role') ?? undefined, reason: q.get('reason') ?? undefined, ...body });
  if (!parsed.success) return NextResponse.json({ error: 'Choose an organisation and a seat, and give a short reason.' }, { status: 400 });
  const b = parsed.data;
  return guarded('018', async () => {
    const r = await unassign(b.orgId, b.role, actor.id, b.reason);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  });
}
