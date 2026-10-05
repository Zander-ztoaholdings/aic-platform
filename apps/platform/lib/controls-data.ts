import {
  getTenantDb, integrationChecks, orgPolicies, policyAcceptances, auditRequirements, auditDocuments,
  orgFrameworks, customFrameworks, customFrameworkRequirements, eq, asc,
} from '@aic/db';
import {
  evaluateCommon, evaluateFramework, evaluateAic, AIC_FRAMEWORK,
  type EvidenceInput, type EvaluatedControl, type EvaluatedCommonControl, type FrameworkMeta,
} from '@/lib/controls';
import { CATALOGUE, CATALOGUE_BY_KEY, DEFAULT_SELECTION, customKey, type CatalogueRequirement } from '@/lib/frameworks/catalog';
import { controlFromSlot } from '@/lib/common-controls';
import { evidenceState } from '@/lib/evidence-vault';
import { CHECK_BY_KEY } from '@/lib/integrations/catalog';
import { TEMPLATE_BY_KEY } from '@/lib/policy-templates';
import { orgMembers } from '@/lib/policies';

export type CustomFramework = {
  id: string; key: string; name: string; description: string | null;
  requirements: (CatalogueRequirement & { rowId: string })[];
};

export type ControlsResult = {
  /** The frameworks the organisation tracks, AIC first, then catalogue, then its own. */
  frameworks: FrameworkMeta[];
  /** Keys of the catalogue frameworks it tracks (AIC is always tracked). */
  selected: string[];
  /** Whether it has saved a choice, or is seeing the defaults. */
  chosen: boolean;
  /** Requirements of the tracked frameworks, evaluated. */
  controls: EvaluatedControl[];
  /** Every catalogue framework evaluated, for the catalogue's coverage figures. */
  catalogue: EvaluatedControl[];
  common: EvaluatedCommonControl[];
  custom: CustomFramework[];
  /** False until migration 015 is applied: choices cannot be saved yet. */
  storeReady: boolean;
};

const docRow = (d: typeof auditDocuments.$inferSelect) => ({
  id: d.id, title: d.title, fileSize: d.fileSize, createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  verificationOutcome: d.verificationOutcome, verificationNotes: d.verificationNotes, verifiedAt: null, supersededBy: d.supersededBy,
});

/** The organisation's evidence, gathered once for every framework. */
export async function gatherEvidence(orgId: string): Promise<EvidenceInput> {
  const db = getTenantDb(orgId);
  const { checks, policies, acceptances, reqs, docs } = await db.query(async (tx) => ({
    checks: await tx.select({ key: integrationChecks.checkKey, status: integrationChecks.status }).from(integrationChecks).where(eq(integrationChecks.orgId, orgId)),
    policies: await tx.select().from(orgPolicies).where(eq(orgPolicies.orgId, orgId)),
    acceptances: await tx.select().from(policyAcceptances).where(eq(policyAcceptances.orgId, orgId)),
    reqs: await tx.select().from(auditRequirements).where(eq(auditRequirements.orgId, orgId)),
    docs: await tx.select().from(auditDocuments).where(eq(auditDocuments.orgId, orgId)),
  }));
  const members = await orgMembers(orgId);

  const input: EvidenceInput = { checks: {}, policies: {}, requirements: {}, documents: {} };
  for (const c of checks) (input.checks[c.key] ??= []).push(c.status);
  for (const p of policies) {
    if (!p.templateKey) continue;
    const ids = new Set(acceptances.filter((a) => a.policyId === p.id && a.version === p.publishedVersion).map((a) => a.userId));
    input.policies[p.templateKey] = { id: p.id, published: p.publishedVersion > 0, acceptedAll: members.length > 0 && members.every((m) => ids.has(m.id)) };
  }
  for (const r of reqs) {
    if (!r.code) continue;
    const mine = docs.filter((d) => d.requirementId === r.id).map(docRow);
    input.requirements[r.code] = { id: r.id, state: evidenceState(mine), text: r.title, right: r.rightCode };
  }
  const byControl = new Map<string, ReturnType<typeof docRow>[]>();
  for (const d of docs) {
    const k = !d.requirementId ? controlFromSlot(d.slotType) : null;
    if (!k) continue;
    const list = byControl.get(k) ?? [];
    list.push(docRow(d));
    byControl.set(k, list);
  }
  for (const [k, list] of byControl) input.documents![k] = { state: evidenceState(list), count: list.filter((d) => !d.supersededBy).length };
  return input;
}

/** Which frameworks the organisation tracks, and its own frameworks. Tolerates migration 015 not being applied yet. */
export async function loadFrameworkChoice(orgId: string): Promise<{ selected: string[]; chosen: boolean; custom: CustomFramework[]; storeReady: boolean }> {
  try {
    const db = getTenantDb(orgId);
    const { rows, fws, reqs } = await db.query(async (tx) => ({
      rows: await tx.select({ key: orgFrameworks.frameworkKey }).from(orgFrameworks).where(eq(orgFrameworks.orgId, orgId)),
      fws: await tx.select().from(customFrameworks).where(eq(customFrameworks.orgId, orgId)).orderBy(asc(customFrameworks.createdAt)),
      reqs: await tx.select().from(customFrameworkRequirements).where(eq(customFrameworkRequirements.orgId, orgId)).orderBy(asc(customFrameworkRequirements.position)),
    }));
    const chosen = rows.length > 0;
    const selected = chosen ? rows.map((r) => r.key).filter((k) => k in CATALOGUE_BY_KEY) : DEFAULT_SELECTION;
    const custom = fws.map((f) => ({
      id: f.id, key: customKey(f.id), name: f.name, description: f.description,
      requirements: reqs.filter((r) => r.frameworkId === f.id).map((r) => ({ rowId: r.id, id: r.ref, title: r.title, controls: r.controls ?? [] })),
    }));
    return { selected, chosen, custom, storeReady: true };
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code !== '42P01') console.error('[FRAMEWORKS] could not load the organisation\'s frameworks:', e);
    return { selected: DEFAULT_SELECTION, chosen: false, custom: [], storeReady: false };
  }
}

/** Every tracked framework, evaluated against the organisation's own evidence. */
export async function computeControls(orgId: string): Promise<ControlsResult> {
  const [input, choice] = await Promise.all([gatherEvidence(orgId), loadFrameworkChoice(orgId)]);
  const common = evaluateCommon(input, (k) => CHECK_BY_KEY[k]?.title ?? k, (k) => TEMPLATE_BY_KEY[k]?.title ?? k);
  const catalogue = CATALOGUE.flatMap((f) => evaluateFramework(f.key, f.requirements, common));
  const selected = CATALOGUE.filter((f) => choice.selected.includes(f.key)).map((f) => f.key);

  const frameworks: FrameworkMeta[] = [
    AIC_FRAMEWORK,
    ...CATALOGUE.filter((f) => selected.includes(f.key)).map(({ requirements: _r, ...meta }) => meta),
    ...choice.custom.map((c) => ({ key: c.key, name: c.name, note: c.description || 'A framework your organisation added.', custom: true })),
  ];
  const controls = [
    ...evaluateAic(input),
    ...catalogue.filter((c) => selected.includes(c.framework)),
    ...choice.custom.flatMap((c) => evaluateFramework(c.key, c.requirements, common)),
  ];
  return { frameworks, selected, chosen: choice.chosen, controls, catalogue, common, custom: choice.custom, storeReady: choice.storeReady };
}
