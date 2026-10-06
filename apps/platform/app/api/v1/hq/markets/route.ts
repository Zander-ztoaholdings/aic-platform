import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, users, hqJurisdictions, hqJurisdictionEvents, eq, asc, desc, inArray } from '@aic/db';
import { guarded } from '@/lib/registers/caller';
import { validateCreate, summarise, todayIso, STAGES } from '@/lib/markets';

export const dynamic = 'force-dynamic';

/** HQ is AIC's own business: super admins only, read from the database, never while previewing another role. */
async function hqUser(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  if (!id || (session?.user as { viewAs?: unknown } | undefined)?.viewAs) return null;
  const [u] = await getSystemDb().select({ s: users.isSuperAdmin }).from(users).where(eq(users.id, id)).limit(1);
  return u?.s ? id : null;
}

/** Furthest along first; paused markets last. */
const rank = (s: string) => (s === 'paused' ? -1 : STAGES.indexOf(s as never));

const denied = () => NextResponse.json({ error: 'Only an AIC super admin can see markets.' }, { status: 403 });

export async function GET() {
  const userId = await hqUser();
  if (!userId) return denied();
  return guarded('017', async () => {
    const db = getSystemDb();
    const rows = await db.select().from(hqJurisdictions).orderBy(asc(hqJurisdictions.name));
    const ids = rows.map((r) => r.id);
    const events = ids.length
      ? await db
          .select({
            id: hqJurisdictionEvents.id, jurisdictionId: hqJurisdictionEvents.jurisdictionId, fromStage: hqJurisdictionEvents.fromStage,
            toStage: hqJurisdictionEvents.toStage, note: hqJurisdictionEvents.note, createdAt: hqJurisdictionEvents.createdAt, actorName: users.name,
          })
          .from(hqJurisdictionEvents)
          .leftJoin(users, eq(users.id, hqJurisdictionEvents.actorId))
          .where(inArray(hqJurisdictionEvents.jurisdictionId, ids))
          .orderBy(desc(hqJurisdictionEvents.createdAt))
      : [];
    const byMarket = new Map<string, typeof events>();
    for (const e of events) {
      const list = byMarket.get(e.jurisdictionId) ?? [];
      if (list.length < 5) list.push(e);
      byMarket.set(e.jurisdictionId, list);
    }
    const markets = rows
      .map((r) => ({ ...r, events: byMarket.get(r.id) ?? [] }))
      .sort((a, b) => rank(b.stage) - rank(a.stage) || a.name.localeCompare(b.name));
    return NextResponse.json({ markets, summary: summarise(rows, todayIso()), today: todayIso() });
  });
}

export async function POST(req: Request) {
  const userId = await hqUser();
  if (!userId) return denied();
  const body = await req.json().catch(() => null);
  const v = validateCreate(body);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
  const { note, ...fields } = v.value;
  return guarded('017', async () => {
    const db = getSystemDb();
    const [dupe] = await db.select({ id: hqJurisdictions.id }).from(hqJurisdictions).where(eq(hqJurisdictions.code, fields.code)).limit(1);
    if (dupe) return NextResponse.json({ error: `There is already a market with the code ${fields.code}.` }, { status: 409 });
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(hqJurisdictions).values({ ...fields, updatedBy: userId }).returning();
      await tx.insert(hqJurisdictionEvents).values({
        jurisdictionId: row.id, actorId: userId, fromStage: null, toStage: row.stage, note: note ?? 'Added to the markets board.',
      });
      return row;
    });
    return NextResponse.json({ market: created }, { status: 201 });
  });
}
