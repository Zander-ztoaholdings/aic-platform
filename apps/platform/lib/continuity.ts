import { createHash } from 'crypto';
import type { OrgOverview } from './org-overview';

/**
 * The continuity record.
 *
 * AIC has no accreditation, so a certificate it issues is worth what AIC's own
 * reputation is worth, which is not yet enough to sell on. The record is a
 * different asset entirely. An unbroken, hash-chained account of what AI an
 * organisation was running, who was accountable for it and what changed — kept
 * from the day they signed up — answers "what did you know and when" in a way
 * that cannot be assembled after the fact. That has standing whether or not the
 * certificate does.
 *
 * Everything in this file above observeEstate() is pure, because everything in
 * it is a judgement: what counts as a change, what counts as drift, and how a
 * hash is computed. Those are the parts that must be testable without a
 * database, and they are the parts someone will one day argue with.
 *
 * WHAT THE RECORD TRACKS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It tracks entities: AI systems, accountable persons, findings, certificates,
 * and systems observed deciding that were never declared. It does not track
 * counters. A record that emitted an event every time a decision tally moved
 * would bury the three events that matter under ten thousand that do not, and
 * an evidence trail nobody can read is not evidence. Counters live in the
 * overview, where they belong.
 */

export const PURPOSE_REQUIRED_STAGES = ['PRODUCTION'];
export const EVIDENCE_STALE_DAYS = 90;
export const DECLARATION_STALE_DAYS = 365;

const DAY = 24 * 60 * 60 * 1000;

export type SystemState = {
  name: string;
  version: string | null;
  purpose: string | null;
  riskTier: number | null;
  lifecycleStage: string | null;
  status: string | null;
  isSandbox: boolean | null;
};

export type PersonState = {
  name: string;
  jobTitle: string | null;
  declarationVersion: string;
  declarationAcceptedAt: string | null;
};

export type FindingState = {
  title: string;
  severity: string;
  status: string;
};

export type EstateState = {
  systems: Record<string, SystemState>;
  persons: Record<string, PersonState>;
  findings: Record<string, FindingState>;
  /** Observed, not declared: system name → decisions seen. */
  undeclared: Record<string, number>;
  /** Declared names that have logged at least one decision. */
  decidingNames: string[];
  certificate: { number: string; status: string | null; expires: string | null } | null;
  evidenceLastVerifiedAt: string | null;
};

export type EstateChange = {
  entityType:
    | 'AI_SYSTEM'
    | 'ACCOUNTABLE_PERSON'
    | 'FINDING'
    | 'CERTIFICATE'
    | 'UNDECLARED_SYSTEM';
  entityKey: string;
  entityLabel: string;
  changeType: 'DECLARED' | 'CHANGED' | 'WITHDRAWN' | 'OBSERVED';
  field?: string;
  previousValue?: string | null;
  newValue?: string | null;
};

export type Drift = {
  code: string;
  severity: 'BLOCKING' | 'MATERIAL' | 'ADVISORY';
  title: string;
  detail: string;
  /** How long the condition has held, where that is knowable. */
  ageDays?: number;
};

const str = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

/** Normalise the overview into the shape the record compares against. */
export function snapshotEstate(o: OrgOverview): EstateState {
  if (!o) throw new Error('snapshotEstate requires an overview');

  const systems: Record<string, SystemState> = {};
  for (const s of o.inventory.systems) {
    systems[s.id] = {
      name: s.name,
      version: str(s.version),
      purpose: str(s.purpose?.trim()),
      riskTier: s.riskTier ?? null,
      lifecycleStage: str(s.lifecycleStage),
      status: str(s.status),
      isSandbox: s.isSandbox ?? null,
    };
  }

  const persons: Record<string, PersonState> = {};
  for (const p of o.accountability.persons) {
    persons[p.id] = {
      name: p.name,
      jobTitle: str(p.jobTitle),
      declarationVersion: p.declarationVersion,
      declarationAcceptedAt: iso(p.declarationAcceptedAt),
    };
  }

  const findings: Record<string, FindingState> = {};
  for (const f of o.findings.open) {
    findings[f.id] = { title: f.title, severity: f.severity, status: f.status };
  }

  const undeclared: Record<string, number> = {};
  for (const u of o.inventory.undeclaredButDeciding) {
    undeclared[u.name] = u.decisions;
  }

  return {
    systems,
    persons,
    findings,
    undeclared,
    decidingNames: [...o.decisions.systemNamesLoggingDecisions].sort(),
    certificate: o.certificate
      ? {
          number: o.certificate.number,
          status: str(o.certificate.status),
          expires: iso(o.certificate.expires),
        }
      : null,
    evidenceLastVerifiedAt: iso(o.evidence.lastVerifiedAt),
  };
}

const SYSTEM_FIELDS: (keyof SystemState)[] = [
  'name',
  'version',
  'purpose',
  'riskTier',
  'lifecycleStage',
  'status',
  'isSandbox',
];

/**
 * What changed between two observations.
 *
 * A null previous state means this is the first observation for the
 * organisation, and everything present is emitted as DECLARED. That is
 * correct rather than noisy: the opening balance of a record is part of the
 * record, and an account that starts mid-stream cannot be relied on.
 */
export function diffEstate(prev: EstateState | null, next: EstateState): EstateChange[] {
  const changes: EstateChange[] = [];
  const p = prev;

  // ── AI systems
  for (const [id, s] of Object.entries(next.systems)) {
    const before = p?.systems[id];
    if (!before) {
      changes.push({
        entityType: 'AI_SYSTEM',
        entityKey: id,
        entityLabel: s.name,
        changeType: 'DECLARED',
      });
      continue;
    }
    for (const field of SYSTEM_FIELDS) {
      const a = before[field];
      const b = s[field];
      if (a !== b) {
        changes.push({
          entityType: 'AI_SYSTEM',
          entityKey: id,
          // Labelled with the name it had BEFORE the change, so a rename event
          // reads as "x → y" rather than "y → y".
          entityLabel: before.name,
          changeType: 'CHANGED',
          field,
          previousValue: a === null || a === undefined ? null : String(a),
          newValue: b === null || b === undefined ? null : String(b),
        });
      }
    }
  }
  for (const [id, s] of Object.entries(p?.systems ?? {})) {
    if (!next.systems[id]) {
      changes.push({
        entityType: 'AI_SYSTEM',
        entityKey: id,
        entityLabel: s.name,
        changeType: 'WITHDRAWN',
      });
    }
  }

  // ── Accountable persons
  for (const [id, person] of Object.entries(next.persons)) {
    const before = p?.persons[id];
    if (!before) {
      changes.push({
        entityType: 'ACCOUNTABLE_PERSON',
        entityKey: id,
        entityLabel: person.name,
        changeType: 'DECLARED',
        field: 'declarationVersion',
        newValue: person.declarationVersion,
      });
      continue;
    }
    if (before.declarationVersion !== person.declarationVersion) {
      changes.push({
        entityType: 'ACCOUNTABLE_PERSON',
        entityKey: id,
        entityLabel: person.name,
        changeType: 'CHANGED',
        field: 'declarationVersion',
        previousValue: before.declarationVersion,
        newValue: person.declarationVersion,
      });
    }
    if (before.jobTitle !== person.jobTitle) {
      changes.push({
        entityType: 'ACCOUNTABLE_PERSON',
        entityKey: id,
        entityLabel: person.name,
        changeType: 'CHANGED',
        field: 'jobTitle',
        previousValue: before.jobTitle,
        newValue: person.jobTitle,
      });
    }
  }
  for (const [id, person] of Object.entries(p?.persons ?? {})) {
    if (!next.persons[id]) {
      // Superseded or removed. Either way the person is no longer the current
      // accountable party, and that is the single most important fact this
      // record can carry.
      changes.push({
        entityType: 'ACCOUNTABLE_PERSON',
        entityKey: id,
        entityLabel: person.name,
        changeType: 'WITHDRAWN',
      });
    }
  }

  // ── Undeclared systems. OBSERVED, never DECLARED: this is AIC noticing, not
  //    the organisation stating. A system that disappears from this list has
  //    usually just been declared, which shows up as a DECLARED event on the
  //    system itself, so nothing is emitted here for it.
  for (const [name, n] of Object.entries(next.undeclared)) {
    const before = p?.undeclared[name];
    if (before === undefined) {
      changes.push({
        entityType: 'UNDECLARED_SYSTEM',
        entityKey: name,
        entityLabel: name,
        changeType: 'OBSERVED',
        field: 'decisions',
        newValue: String(n),
      });
    } else if (n !== before) {
      changes.push({
        entityType: 'UNDECLARED_SYSTEM',
        entityKey: name,
        entityLabel: name,
        changeType: 'OBSERVED',
        field: 'decisions',
        previousValue: String(before),
        newValue: String(n),
      });
    }
  }

  // ── Findings. Raised by AIC, so OBSERVED on first appearance.
  for (const [id, f] of Object.entries(next.findings)) {
    const before = p?.findings[id];
    if (!before) {
      changes.push({
        entityType: 'FINDING',
        entityKey: id,
        entityLabel: f.title,
        changeType: 'OBSERVED',
        field: 'severity',
        newValue: f.severity,
      });
    } else if (before.status !== f.status) {
      changes.push({
        entityType: 'FINDING',
        entityKey: id,
        entityLabel: f.title,
        changeType: 'CHANGED',
        field: 'status',
        previousValue: before.status,
        newValue: f.status,
      });
    }
  }
  for (const [id, f] of Object.entries(p?.findings ?? {})) {
    if (!next.findings[id]) {
      changes.push({
        entityType: 'FINDING',
        entityKey: id,
        entityLabel: f.title,
        changeType: 'CHANGED',
        field: 'status',
        previousValue: f.status,
        newValue: 'CLOSED',
      });
    }
  }

  // ── Certificate
  const a = p?.certificate ?? null;
  const b = next.certificate;
  if (!a && b) {
    changes.push({
      entityType: 'CERTIFICATE',
      entityKey: b.number,
      entityLabel: b.number,
      changeType: 'DECLARED',
      field: 'status',
      newValue: b.status,
    });
  } else if (a && b && (a.number !== b.number || a.status !== b.status)) {
    changes.push({
      entityType: 'CERTIFICATE',
      entityKey: b.number,
      entityLabel: b.number,
      changeType: 'CHANGED',
      field: a.number !== b.number ? 'number' : 'status',
      previousValue: a.number !== b.number ? a.number : a.status,
      newValue: a.number !== b.number ? b.number : b.status,
    });
  } else if (a && !b) {
    changes.push({
      entityType: 'CERTIFICATE',
      entityKey: a.number,
      entityLabel: a.number,
      changeType: 'WITHDRAWN',
    });
  }

  return changes;
}

/**
 * Conditions that have held long enough, or contradict each other hard enough,
 * to be worth naming.
 *
 * Distinct from the gaps in org-overview.ts: a gap is something absent, drift
 * is something that has gone stale or that the record now contradicts. Both
 * describe; neither prescribes. AIC does not tell an organisation how to fix
 * its management system, because designing that system is consultancy and it
 * is the line accreditation turns on.
 */
export function deriveDrift(
  state: EstateState,
  prev: EstateState | null,
  now: Date = new Date()
): Drift[] {
  const drift: Drift[] = [];
  const t = now.getTime();
  const ageIn = (v: string | null) => (v ? Math.floor((t - new Date(v).getTime()) / DAY) : null);

  for (const s of Object.values(state.systems)) {
    if (PURPOSE_REQUIRED_STAGES.includes((s.lifecycleStage ?? '').toUpperCase()) && !s.purpose) {
      drift.push({
        code: 'DRIFT-PRODUCTION-NO-PURPOSE',
        severity: 'MATERIAL',
        title: `${s.name} is in production with no stated purpose`,
        detail:
          'A system making live decisions with no recorded purpose cannot be assessed for ' +
          'proportionality, and the record cannot show what it was meant to do.',
      });
    }
  }

  // A declared production system that has never logged a decision is one of two
  // things, and the record cannot tell which: it is not actually in production,
  // or it is in production and not logging. Both matter, so the drift names the
  // ambiguity rather than resolving it.
  const deciding = new Set(state.decidingNames.map((n) => n.trim().toLowerCase()));
  for (const s of Object.values(state.systems)) {
    if (
      PURPOSE_REQUIRED_STAGES.includes((s.lifecycleStage ?? '').toUpperCase()) &&
      !deciding.has(s.name.trim().toLowerCase())
    ) {
      drift.push({
        code: 'DRIFT-SILENT-PRODUCTION-SYSTEM',
        severity: 'MATERIAL',
        title: `${s.name} is declared in production but has logged no decisions`,
        detail:
          'Either it is not in production, or it is and is not logging. The record cannot ' +
          'distinguish the two, and both change what this organisation can evidence.',
      });
    }
  }

  const evidenceAge = ageIn(state.evidenceLastVerifiedAt);
  if (evidenceAge !== null && evidenceAge > EVIDENCE_STALE_DAYS) {
    drift.push({
      code: 'DRIFT-EVIDENCE-STALE',
      severity: 'MATERIAL',
      title: 'No evidence has been verified recently',
      detail: `The last verification was ${evidenceAge} days ago, past the ${EVIDENCE_STALE_DAYS}-day window.`,
      ageDays: evidenceAge,
    });
  }

  for (const person of Object.values(state.persons)) {
    const age = ageIn(person.declarationAcceptedAt);
    if (age !== null && age > DECLARATION_STALE_DAYS) {
      drift.push({
        code: 'DRIFT-DECLARATION-LAPSED',
        severity: 'MATERIAL',
        title: `${person.name}'s declaration is ${age} days old`,
        detail:
          `Accepted under version ${person.declarationVersion}. A declaration older than ` +
          `${DECLARATION_STALE_DAYS} days has outlived the arrangement it described.`,
        ageDays: age,
      });
    }
  }

  if (prev) {
    for (const [name, n] of Object.entries(state.undeclared)) {
      const before = prev.undeclared[name];
      if (before !== undefined && n > before) {
        drift.push({
          code: 'DRIFT-UNDECLARED-GROWING',
          severity: 'BLOCKING',
          title: `${name} is still undeclared and still deciding`,
          detail:
            `Decisions have risen from ${before} to ${n} since the last observation, and the ` +
            'system has not been added to the inventory.',
        });
      }
    }
  }

  const rank = { BLOCKING: 0, MATERIAL: 1, ADVISORY: 2 } as const;
  return drift.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

/**
 * The record narrated in one sentence, next to the raw entry it explains -
 * the compliance officer reading this is not the engineer reading the hash
 * chain. Guild's own audit log does the same thing ("Changed Alex Rivera
 * role to Member" next to the raw operation code) and it is the right shape
 * to borrow: nothing here changes what was recorded, only how it reads.
 *
 * Pure and total - every (entityType, changeType, field) combination the rest
 * of this file can produce has a sentence, and an unrecognised one falls back
 * to something honest rather than throwing.
 */
export function narrateEvent(e: {
  entityType: string;
  entityLabel: string;
  changeType: string;
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
}): string {
  const { entityType, entityLabel: name, changeType, field, previousValue: prev, newValue: next } = e;

  if (entityType === 'AI_SYSTEM') {
    if (changeType === 'DECLARED') return `Declared ${name}.`;
    if (changeType === 'WITHDRAWN') return `Withdrew ${name} from the inventory.`;
    if (changeType === 'CHANGED') {
      if (field === 'purpose') {
        return prev
          ? `Changed ${name}'s stated purpose.`
          : `Added a stated purpose to ${name}.`;
      }
      if (field === 'lifecycleStage') return `Moved ${name} from ${prev ?? 'undeclared'} to ${next}.`;
      if (field === 'status') return `${name}'s status changed from ${prev ?? '—'} to ${next}.`;
      if (field === 'riskTier') return `${name}'s risk tier changed from ${prev ?? '—'} to ${next}.`;
      if (field === 'isSandbox') return `${name} ${next === 'true' ? 'moved into a sandbox' : 'left the sandbox'}.`;
      return `Changed ${name}'s ${field ?? 'record'} from ${prev ?? '—'} to ${next ?? '—'}.`;
    }
  }

  if (entityType === 'ACCOUNTABLE_PERSON') {
    if (changeType === 'DECLARED') return `${name} accepted accountability (declaration ${next}).`;
    if (changeType === 'WITHDRAWN') return `${name} is no longer the accountable person.`;
    if (changeType === 'CHANGED') {
      if (field === 'declarationVersion') return `${name} re-accepted accountability under declaration ${next}.`;
      if (field === 'jobTitle') return `${name}'s title changed from ${prev ?? '—'} to ${next}.`;
      return `Changed ${name}'s ${field ?? 'record'} from ${prev ?? '—'} to ${next ?? '—'}.`;
    }
  }

  if (entityType === 'FINDING') {
    if (changeType === 'OBSERVED') return `AIC raised a finding: "${name}"${next ? ` (${next})` : ''}.`;
    if (changeType === 'CHANGED' && field === 'status') return `Finding "${name}" moved from ${prev ?? '—'} to ${next}.`;
  }

  if (entityType === 'CERTIFICATE') {
    if (changeType === 'DECLARED') return `Certificate ${name} issued${next ? `, status ${next}` : ''}.`;
    if (changeType === 'WITHDRAWN') return `Certificate ${name} withdrawn.`;
    if (changeType === 'CHANGED') {
      if (field === 'number') return `Certificate number changed from ${prev} to ${next}.`;
      return `Certificate ${name} status changed from ${prev ?? '—'} to ${next}.`;
    }
  }

  if (entityType === 'UNDECLARED_SYSTEM' && changeType === 'OBSERVED') {
    return prev
      ? `${name}, still undeclared, logged decisions ${prev} → ${next}.`
      : `${name} logged ${next} decision${next === '1' ? '' : 's'} without being on the declared inventory.`;
  }

  // Unrecognised combination - still honest, never blank.
  const bits = [field, prev, next].filter(Boolean).join(' ');
  return `${changeType.charAt(0) + changeType.slice(1).toLowerCase()}: ${name}${bits ? ` (${bits})` : ''}.`;
}

/**
 * The link hash.
 *
 * Deliberately the same construction as HashChainService.computeHash — one
 * hashing implementation across the codebase, so a future change to it cannot
 * silently apply to one chain and not the other. The event content is hashed
 * with the chain, not merely referenced by it, because this record's whole
 * purpose is to be handed to someone outside AIC who cannot see the rest of
 * the database.
 */
export function linkHash(content: unknown, previousHash: string | null): string {
  const data = JSON.stringify({
    content,
    previousHash:
      previousHash || '0000000000000000000000000000000000000000000000000000000000000000',
  });
  return createHash('sha256').update(data).digest('hex');
}

export type ChainLink = {
  seq: number;
  observedAt: string;
  entityType: string;
  entityKey: string;
  entityLabel: string;
  changeType: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  actorLabel: string;
  previousHash: string | null;
  hash: string;
};

/** The exact object that gets hashed. Isolated so the verifier and the writer
 *  cannot drift apart — if they did, every chain would read as broken. */
export function linkContent(l: Omit<ChainLink, 'hash' | 'previousHash'>) {
  return {
    seq: l.seq,
    observedAt: l.observedAt,
    entityType: l.entityType,
    entityKey: l.entityKey,
    entityLabel: l.entityLabel,
    changeType: l.changeType,
    field: l.field,
    previousValue: l.previousValue,
    newValue: l.newValue,
    actorLabel: l.actorLabel,
  };
}

/** Recompute the chain and report the first link that does not hold. */
export function verifyChain(links: ChainLink[]): {
  valid: boolean;
  brokenAtSeq?: number;
  reason?: string;
} {
  let running: string | null = null;
  let expectedSeq = links.length > 0 ? links[0].seq : 1;

  for (const l of links) {
    if (l.seq !== expectedSeq) {
      return {
        valid: false,
        brokenAtSeq: l.seq,
        reason: `sequence jumped from ${expectedSeq - 1} to ${l.seq}`,
      };
    }
    if (l.previousHash !== running) {
      return { valid: false, brokenAtSeq: l.seq, reason: 'previous hash does not match' };
    }
    const recomputed = linkHash(linkContent(l), running);
    if (recomputed !== l.hash) {
      return { valid: false, brokenAtSeq: l.seq, reason: 'content does not match its hash' };
    }
    running = l.hash;
    expectedSeq += 1;
  }

  return { valid: true };
}
