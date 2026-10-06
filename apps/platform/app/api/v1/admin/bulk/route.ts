import { NextRequest, NextResponse } from 'next/server';
import { adminActor, recordAdminAction } from '@/lib/admin';
import { isUuid } from '@/lib/policy-hash';
import {
  BULK_MAX, DESTRUCTIVE, confirmPhrase, planOrgs, planUsers, orgFacts, userFacts, activeSuperAdmins, checkOwnPassword,
  purgeOrg, suspendOrg, restoreOrg, applyToUser, type OrgAction, type UserAction,
} from '@/lib/admin-bulk';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ORG_ACTIONS: OrgAction[] = ['suspend', 'restore', 'delete'];
const USER_ACTIONS: UserAction[] = ['deactivate', 'reactivate', 'remove'];

/**
 * One bulk action on organisations or accounts.
 * { kind, action, ids, preview: true } returns the plan and nothing changes.
 * { kind, action, ids, reason, confirm?, password? } carries it out; deleting
 * or removing also needs the confirm phrase and the person's password.
 * Super admins only for organisations; manage_users for accounts.
 */
export async function POST(request: NextRequest) {
  const b = (await request.json().catch(() => ({}))) as { kind?: string; action?: string; ids?: unknown; preview?: boolean; reason?: string; confirm?: string; password?: string };
  const kind = b.kind === 'organizations' ? 'organizations' : b.kind === 'users' ? 'users' : null;
  if (!kind) return NextResponse.json({ error: 'Say whether these are organisations or accounts.' }, { status: 400 });
  const actor = await adminActor('manage_users');
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (kind === 'organizations' && !actor.isSuperAdmin) return NextResponse.json({ error: 'Only a super admin can act on organisations in bulk.' }, { status: 403 });
  const action = String(b.action ?? '');
  if (kind === 'organizations' ? !ORG_ACTIONS.includes(action as OrgAction) : !USER_ACTIONS.includes(action as UserAction)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).filter((x): x is string => typeof x === 'string' && isUuid(x)))];
  if (!ids.length) return NextResponse.json({ error: 'Select at least one.' }, { status: 400 });
  if (ids.length > BULK_MAX) return NextResponse.json({ error: `At most ${BULK_MAX} at a time.` }, { status: 400 });

  const plan = kind === 'organizations'
    ? planOrgs(action as OrgAction, await orgFacts(ids, actor.id))
    : planUsers(action as UserAction, await userFacts(ids), actor, await activeSuperAdmins());
  const doing = plan.filter((p) => !p.skip);
  const phrase = confirmPhrase(kind, action, doing.length);

  if (b.preview) return NextResponse.json({ plan, count: doing.length, phrase, needsPassword: DESTRUCTIVE.has(action) });

  if (!doing.length) return NextResponse.json({ error: 'Nothing in the selection can be changed.' }, { status: 409 });
  const reason = (b.reason ?? '').trim();
  if (reason.length < 3) return NextResponse.json({ error: 'Give a reason.' }, { status: 400 });
  if (phrase) {
    if ((b.confirm ?? '').trim().toLowerCase() !== phrase) return NextResponse.json({ error: `Type “${phrase}” exactly to confirm.`, phrase }, { status: 400 });
    const bad = await checkOwnPassword(actor.id, b.password);
    if (bad) return NextResponse.json({ error: bad }, { status: 401 });
  }

  const done: string[] = []; const failed: { label: string; error: string }[] = [];
  for (const item of doing) {
    try {
      if (kind === 'organizations') {
        if (action === 'delete') await purgeOrg(item.id, actor.id);
        else if (action === 'suspend') await suspendOrg(item.id, actor.id, reason);
        else await restoreOrg(item.id, actor.id, reason);
      } else {
        const [u] = await userFacts([item.id]);
        if (u) await applyToUser(action as UserAction, u, actor.id, reason);
      }
      done.push(item.label);
    } catch (e) {
      const cause = (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message;
      console.error('[ADMIN_BULK]', kind, action, item.id, cause);
      failed.push({ label: item.label, error: 'The database refused it; nothing was changed for this one.' });
    }
  }
  // One record of the whole batch, with every name, that survives the deletion itself.
  await recordAdminAction({
    actorId: actor.id, orgId: null, targetType: kind === 'organizations' ? 'ADMIN_ORG' : 'ADMIN_USER', targetId: null,
    previous: { selected: plan.map((p) => ({ id: p.id, label: p.label, skipped: p.skip })) },
    next: { bulk: action, done, failed: failed.map((f) => f.label) }, reason,
  }).catch(() => {});
  return NextResponse.json({ done: done.length, skipped: plan.length - doing.length, failed });
}
