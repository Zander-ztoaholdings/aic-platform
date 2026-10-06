import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, users, hitlLogs, hqJurisdictions, hqJurisdictionEvents, eq, and, ne, desc } from '@aic/db';
import { guarded } from '@/lib/registers/caller';
import { validateUpdate, validateDelete } from '@/lib/markets';

export const dynamic = 'force-dynamic';

/** HQ is AIC's own business: super admins only, read from the database, never while previewing another role. */
async function hqUser(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id as string | undefined;
  if (!id || (session?.user as { viewAs?: unknown } | undefined)?.viewAs) return null;
  const [u] = await getSystemDb().select({ s: users.isSuperAdmin }).from(users).where(eq(users.id, id)).limit(1);
  return u?.s ? id : null;
}

const denied = () => NextResponse.json({ error: 'Only an AIC super admin can change markets.' }, { status: 403 });
const notFound = () => NextResponse.json({ error: 'That market no longer exists.' }, { status: 404 });
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

type Ctx = { params: Promise<{ id: string }> };

/** One market with its whole history, newest first. */
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await hqUser();
  if (!userId) return denied();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  return guarded('017', async () => {
    const db = getSystemDb();
    const [market] = await db.select().from(hqJurisdictions).where(eq(hqJurisdictions.id, id)).limit(1);
    if (!market) return notFound();
    const events = await db
      .select({
        id: hqJurisdictionEvents.id, fromStage: hqJurisdictionEvents.fromStage, toStage: hqJurisdictionEvents.toStage,
        note: hqJurisdictionEvents.note, createdAt: hqJurisdictionEvents.createdAt, actorName: users.name,
      })
      .from(hqJurisdictionEvents)
      .leftJoin(users, eq(users.id, hqJurisdictionEvents.actorId))
      .where(eq(hqJurisdictionEvents.jurisdictionId, id))
      .orderBy(desc(hqJurisdictionEvents.createdAt))
      .limit(200);
    return NextResponse.json({ market, events });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await hqUser();
  if (!userId) return denied();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await req.json().catch(() => null);
  return guarded('017', async () => {
    const db = getSystemDb();
    const [current] = await db.select().from(hqJurisdictions).where(eq(hqJurisdictions.id, id)).limit(1);
    if (!current) return notFound();
    const v = validateUpdate(body, current.stage);
    if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });
    const { fields, stage, note } = v.value;
    if (fields.code && fields.code !== current.code) {
      const [dupe] = await db.select({ id: hqJurisdictions.id }).from(hqJurisdictions)
        .where(and(eq(hqJurisdictions.code, fields.code), ne(hqJurisdictions.id, id))).limit(1);
      if (dupe) return NextResponse.json({ error: `There is already a market with the code ${fields.code}.` }, { status: 409 });
    }
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(hqJurisdictions)
        .set({ ...fields, ...(stage ? { stage } : {}), updatedBy: userId, updatedAt: new Date() })
        .where(eq(hqJurisdictions.id, id))
        .returning();
      if (stage) {
        await tx.insert(hqJurisdictionEvents).values({ jurisdictionId: id, actorId: userId, fromStage: current.stage, toStage: stage, note: note! });
      } else if (note) {
        await tx.insert(hqJurisdictionEvents).values({ jurisdictionId: id, actorId: userId, fromStage: null, toStage: null, note });
      }
      return row;
    });
    return NextResponse.json({ market: updated });
  });
}

/** Removes a market nobody has worked on yet. The reason goes on the admin log, since the market's own history goes with it. */
export async function DELETE(req: Request, { params }: Ctx) {
  const userId = await hqUser();
  if (!userId) return denied();
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = body?.reason ?? new URL(req.url).searchParams.get('reason');
  return guarded('017', async () => {
    const db = getSystemDb();
    const [current] = await db.select().from(hqJurisdictions).where(eq(hqJurisdictions.id, id)).limit(1);
    if (!current) return notFound();
    const v = validateDelete(current.stage, reason);
    if ('error' in v) return NextResponse.json({ error: v.error }, { status: v.status });
    await db.transaction(async (tx) => {
      await tx.insert(hitlLogs).values({
        orgId: null, actorId: userId, targetType: 'HQ_MARKET', targetId: id,
        previousValue: current as unknown as object, newValue: null, overrideReason: v.reason,
      });
      await tx.delete(hqJurisdictions).where(eq(hqJurisdictions.id, id));
    });
    return NextResponse.json({ ok: true });
  });
}
