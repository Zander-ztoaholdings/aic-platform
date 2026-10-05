import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb, orgPeople, eq } from '@aic/db';
import { orgCaller, guarded } from '@/lib/registers/caller';
import { listAccounts, matchesPerson } from '@/lib/registers/accounts';
import { forgetLeavers } from '@/lib/registers/facts';
import { cleanPerson, parsePeopleCsv } from '@/lib/registers/people';

export const dynamic = 'force-dynamic';

/**
 * People: joiners and leavers. With ?accounts=1, each person is matched to the
 * accounts AIC can see, so a leaver who still has access stands out.
 */
export async function GET(request: NextRequest) {
  const c = await orgCaller();
  if ('error' in c) return c.error;
  const withAccounts = request.nextUrl.searchParams.get('accounts') === '1';
  return guarded('016', async () => {
    const rows = await getTenantDb(c.orgId).query((tx) => tx.select().from(orgPeople).where(eq(orgPeople.orgId, c.orgId)).orderBy(orgPeople.name));
    let notes: string[] = [];
    let accounts: Awaited<ReturnType<typeof listAccounts>>['accounts'] = [];
    if (withAccounts) ({ accounts, notes } = await listAccounts(c.orgId));
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      canManage: c.canManage, notes, checkedAccounts: withAccounts,
      people: rows.map((p) => ({
        ...p,
        state: p.endDate && p.endDate < today ? 'left' : p.startDate && p.startDate > today ? 'joining' : 'current',
        accounts: withAccounts ? accounts.filter((a) => matchesPerson(a, p)).map((a) => ({ system: a.system, account: a.account, enabled: a.enabled, privilege: a.privilege })) : null,
      })),
    });
  });
}

/** Add one person ({ name, email, ... }) or import a CSV ({ csv }). */
export async function POST(request: NextRequest) {
  const c = await orgCaller({ manage: true });
  if ('error' in c) return c.error;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = typeof b.csv === 'string' ? parsePeopleCsv(b.csv) : (() => { const v = cleanPerson(b); return 'error' in v ? v : { people: [v.value], skipped: 0 }; })();
  if ('error' in rows) return NextResponse.json({ error: rows.error }, { status: 400 });
  if (!rows.people.length) return NextResponse.json({ error: 'No rows with a name were found.' }, { status: 400 });
  return guarded('016', async () => {
    // Someone already listed under the same email is skipped, so importing the same export twice does not double everyone.
    const added = await getTenantDb(c.orgId).query(async (tx) => {
      const have = new Set((await tx.select({ email: orgPeople.email }).from(orgPeople).where(eq(orgPeople.orgId, c.orgId))).map((r) => (r.email ?? '').toLowerCase()).filter(Boolean));
      const fresh = rows.people.filter((p) => !p.email || !have.has(p.email.toLowerCase()));
      if (fresh.length) await tx.insert(orgPeople).values(fresh.map((p) => ({ orgId: c.orgId, ...p })));
      return fresh.length;
    });
    forgetLeavers(c.orgId);
    return NextResponse.json({ added, skipped: rows.skipped, alreadyListed: rows.people.length - added }, { status: 201 });
  });
}
