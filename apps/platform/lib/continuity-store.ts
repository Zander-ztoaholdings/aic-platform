import {
  getTenantDb,
  estateEvents,
  estateSnapshots,
  eq,
  desc,
  asc,
} from '@aic/db';
import { buildOrgOverview } from './org-overview';
import {
  snapshotEstate,
  diffEstate,
  deriveDrift,
  linkHash,
  linkContent,
  verifyChain,
  type EstateState,
  type ChainLink,
  type Drift,
} from './continuity';

/**
 * The database half of the continuity record. Everything that exercises
 * judgement lives in ./continuity.ts and is tested without a database; this
 * file only reads, chains and writes.
 */

const OBSERVER = 'AIC continuity observer';

export type ObservationResult = {
  firstObservation: boolean;
  eventsWritten: number;
  fromSeq: number | null;
  toSeq: number | null;
  drift: Drift[];
};

/**
 * Take an observation: compare the organisation's current declared state
 * against the last one, append an event per change, and move the cursor.
 *
 * Idempotent in the way that matters — a second run with nothing changed
 * writes nothing and leaves the chain untouched. That property is load-bearing.
 * A record that grows when nothing happened is a record whose length means
 * nothing, and the first question anyone asks of an audit trail is whether its
 * volume is signal.
 */
export async function observeEstate(
  orgId: string,
  actorLabel: string = OBSERVER,
  actorUserId: string | null = null,
  // Overrides "now" for every event and the snapshot this observation writes.
  // Exists for scripts/seed-demo-org.ts, which builds a believable multi-week
  // history rather than a pile of events all timestamped the moment it ran -
  // every real caller leaves this as new Date().
  observedAt: Date = new Date()
): Promise<ObservationResult | null> {
  const overview = await buildOrgOverview(orgId);
  if (!overview) return null;

  const current = snapshotEstate(overview);
  const db = getTenantDb(orgId);

  return db.transaction(async (tx) => {
    const [cursor] = await tx
      .select({ state: estateSnapshots.state, eventSeq: estateSnapshots.eventSeq })
      .from(estateSnapshots)
      .where(eq(estateSnapshots.orgId, orgId))
      .limit(1);

    const previous = (cursor?.state as EstateState | undefined) ?? null;
    const changes = diffEstate(previous, current);
    const drift = deriveDrift(current, previous);

    // The head of the chain comes from the events themselves, never from the
    // cursor. If a previous run died between writing events and updating the
    // cursor, trusting the cursor would fork the chain; trusting the events
    // re-derives the same head and the worst case is a few duplicate events,
    // which are visible rather than silent.
    const [head] = await tx
      .select({ seq: estateEvents.seq, hash: estateEvents.hash })
      .from(estateEvents)
      .where(eq(estateEvents.orgId, orgId))
      .orderBy(desc(estateEvents.seq))
      .limit(1);

    let seq = head?.seq ?? 0;
    let previousHash: string | null = head?.hash ?? null;
    const fromSeq = changes.length > 0 ? seq + 1 : null;

    for (const change of changes) {
      seq += 1;
      const content = linkContent({
        seq,
        observedAt: observedAt.toISOString(),
        entityType: change.entityType,
        entityKey: change.entityKey,
        entityLabel: change.entityLabel,
        changeType: change.changeType,
        field: change.field ?? null,
        previousValue: change.previousValue ?? null,
        newValue: change.newValue ?? null,
        actorLabel,
      });
      const hash = linkHash(content, previousHash);

      await tx.insert(estateEvents).values({
        orgId,
        seq,
        observedAt,
        entityType: change.entityType,
        entityKey: change.entityKey,
        entityLabel: change.entityLabel,
        changeType: change.changeType,
        field: change.field ?? null,
        previousValue: change.previousValue ?? null,
        newValue: change.newValue ?? null,
        actorLabel,
        actorUserId,
        previousHash,
        hash,
      });

      previousHash = hash;
    }

    await tx
      .insert(estateSnapshots)
      .values({ orgId, takenAt: observedAt, eventSeq: seq, state: current as unknown as object })
      .onConflictDoUpdate({
        target: estateSnapshots.orgId,
        set: { takenAt: observedAt, eventSeq: seq, state: current as unknown as object },
      });

    return {
      firstObservation: previous === null,
      eventsWritten: changes.length,
      fromSeq,
      toSeq: changes.length > 0 ? seq : null,
      drift,
    };
  });
}

export type ContinuityView = {
  events: ChainLink[];
  total: number;
  since: string | null;
  chain: ReturnType<typeof verifyChain>;
  drift: Drift[];
  lastObservedAt: string | null;
};

/**
 * Read the record back, newest first, and verify the chain.
 *
 * Verification runs over the whole chain rather than the page being displayed,
 * because a chain that is only checked where someone happens to be looking is
 * not checked. It is an O(n) read per page load, which is fine at the volumes
 * an entity record produces and is the wrong thing to optimise first: the
 * moment this says "valid" without having looked, the record stops being worth
 * anything.
 */
export async function readContinuity(orgId: string, limit = 50): Promise<ContinuityView> {
  const db = getTenantDb(orgId);

  return db.query(async (tx) => {
    const all = await tx
      .select({
        seq: estateEvents.seq,
        observedAt: estateEvents.observedAt,
        entityType: estateEvents.entityType,
        entityKey: estateEvents.entityKey,
        entityLabel: estateEvents.entityLabel,
        changeType: estateEvents.changeType,
        field: estateEvents.field,
        previousValue: estateEvents.previousValue,
        newValue: estateEvents.newValue,
        actorLabel: estateEvents.actorLabel,
        previousHash: estateEvents.previousHash,
        hash: estateEvents.hash,
      })
      .from(estateEvents)
      .where(eq(estateEvents.orgId, orgId))
      .orderBy(asc(estateEvents.seq));

    const links: ChainLink[] = all.map((e) => ({
      seq: Number(e.seq),
      observedAt: new Date(e.observedAt as unknown as string).toISOString(),
      entityType: e.entityType,
      entityKey: e.entityKey,
      entityLabel: e.entityLabel,
      changeType: e.changeType,
      field: e.field,
      previousValue: e.previousValue,
      newValue: e.newValue,
      actorLabel: e.actorLabel,
      previousHash: e.previousHash,
      hash: e.hash,
    }));

    const [cursor] = await tx
      .select({ state: estateSnapshots.state, takenAt: estateSnapshots.takenAt })
      .from(estateSnapshots)
      .where(eq(estateSnapshots.orgId, orgId))
      .limit(1);

    const state = (cursor?.state as EstateState | undefined) ?? null;

    return {
      events: links.slice(-limit).reverse(),
      total: links.length,
      since: links.length > 0 ? links[0].observedAt : null,
      chain: verifyChain(links),
      // Drift is recomputed against the cursor rather than read from storage:
      // "this has been stale for 94 days" is true relative to now, and a stored
      // copy of it would quietly go wrong between observations.
      drift: state ? deriveDrift(state, null) : [],
      lastObservedAt: cursor?.takenAt
        ? new Date(cursor.takenAt as unknown as string).toISOString()
        : null,
    };
  });
}
