/**
 * Frameworks, their requirements, and what evidence on the platform speaks to
 * each one.
 *
 * Evidence is gathered once, against the common controls
 * (lib/common-controls.ts): automated checks, adopted policies, evidence AIC
 * has accepted against the AIC standard, and documents filed against the
 * control. Each framework requirement then takes the status of the common
 * controls it maps to (lib/frameworks). The AIC standard itself is listed
 * requirement by requirement, straight from the evidence vault.
 *
 * A status here is a summary of evidence, not a conformity decision.
 * "Evidenced" means every source AIC can see is positive; only an assessment
 * says whether a requirement is actually met.
 */
import { COMMON_CONTROLS, type CommonArea, type CommonSource } from './common-controls';
import { CATALOGUE, type CatalogueRequirement } from './frameworks/catalog';

/** 'aic', a catalogue key such as 'soc2', or 'custom:<uuid>'. */
export type Framework = string;

export type FrameworkMeta = {
  key: Framework;
  name: string;
  note: string;
  fullName?: string;
  publisher?: string;
  version?: string;
  region?: string;
  appliesTo?: string;
  group?: string;
  sources?: string[];
  custom?: boolean;
};

export const AIC_FRAMEWORK: FrameworkMeta = {
  key: 'aic',
  name: 'AIC standard',
  note: 'The requirements of the AIC standard that apply to your Division, each evidenced by what you have filed in the Evidence Vault.',
};

export type SourceStatus = 'pass' | 'fail' | 'pending' | 'none';
export type ControlStatus = 'evidenced' | 'partial' | 'gap' | 'no_evidence' | 'not_mapped';

export type EvidenceInput = {
  /** check key → statuses across subjects */
  checks: Record<string, string[]>;
  /** policy template key → { id, published, acceptedAll } */
  policies: Record<string, { id: string; published: boolean; acceptedAll: boolean }>;
  /** requirement code → vault state */
  requirements: Record<string, { id: string; state: string; text: string; right: string | null }>;
  /** common control key → state of the documents filed against it (evidenceState) and how many */
  documents?: Record<string, { state: string; count: number }>;
  /** register facts (lib/registers/facts): suppliers, risks, training, access_review, leavers */
  facts?: Record<string, { status: SourceStatus; label: string; href: string }>;
};

export type EvaluatedSource = { label: string; status: SourceStatus; href: string };
export type EvaluatedControl = { framework: Framework; id: string; title: string; status: ControlStatus; sources: EvaluatedSource[]; controls?: string[] };
export type EvaluatedCommonControl = {
  key: string; area: CommonArea; title: string; evidence: string; status: ControlStatus;
  sources: EvaluatedSource[]; documents: number;
};

export function sourceStatus(s: CommonSource, e: EvidenceInput): EvaluatedSource {
  if (s.kind === 'check') {
    const st = e.checks[s.key] ?? [];
    const status: SourceStatus = st.length === 0 ? 'none' : st.includes('fail') ? 'fail' : st.every((x) => x === 'pass') ? 'pass' : 'pending';
    return { label: s.key, status, href: '/checks' };
  }
  if (s.kind === 'policy') {
    const p = e.policies[s.key];
    const status: SourceStatus = !p ? 'none' : !p.published ? 'none' : p.acceptedAll ? 'pass' : 'pending';
    return { label: s.key, status, href: p ? `/policies/${p.id}` : '/policies' };
  }
  if (s.kind === 'fact') {
    const f = e.facts?.[s.key];
    return f ? { label: f.label, status: f.status, href: f.href } : { label: s.key, status: 'none', href: '/controls' };
  }
  const r = e.requirements[s.code];
  return { label: s.code, status: vaultStatus(r?.state), href: '/evidence' };
}

const vaultStatus = (state: string | undefined): SourceStatus =>
  state === 'accepted' ? 'pass' : state === 'needs_more' ? 'fail' : state === 'submitted' ? 'pending' : 'none';

export function rollUp(statuses: SourceStatus[]): ControlStatus {
  if (statuses.includes('fail')) return 'gap';
  if (statuses.length > 0 && statuses.every((s) => s === 'pass')) return 'evidenced';
  if (statuses.some((s) => s === 'pass' || s === 'pending')) return 'partial';
  return 'no_evidence';
}

/**
 * A source only counts where it applies to the organisation: a check from a
 * system it has not connected, or an AIC requirement outside its Division, is
 * left out rather than counted against it. Policies always count, because
 * adopting one is always open to the organisation. Documents count once any
 * are filed, and are the only source for controls nothing else can see.
 */
function applies(s: CommonSource, e: EvidenceInput): boolean {
  if (s.kind === 'check') return (e.checks[s.key] ?? []).length > 0;
  if (s.kind === 'requirement') return s.code in e.requirements;
  if (s.kind === 'fact') return !!e.facts?.[s.key];
  return true;
}

export function evaluateCommon(e: EvidenceInput, checkTitle: (k: string) => string, policyTitle: (k: string) => string): EvaluatedCommonControl[] {
  return COMMON_CONTROLS.map((c) => {
    const live = c.sources.filter((s) => applies(s, e));
    const sources: EvaluatedSource[] = live.map((s) => ({
      ...sourceStatus(s, e),
      label: s.kind === 'check' ? checkTitle(s.key) : s.kind === 'policy' ? policyTitle(s.key) : s.kind === 'fact' ? sourceStatus(s, e).label : `${s.code} evidence`,
    }));
    const doc = e.documents?.[c.key];
    const docSource: EvaluatedSource = {
      label: doc?.count ? `${doc.count} document${doc.count === 1 ? '' : 's'} filed against this control` : 'Documents filed against this control',
      status: vaultStatus(doc?.state),
      href: `/controls?view=common#${c.key}`,
    };
    const counted = doc?.count ? [...sources, docSource] : sources;
    return {
      key: c.key, area: c.area, title: c.title, evidence: c.evidence,
      status: rollUp(counted.map((s) => s.status)),
      sources: [...sources, docSource],
      documents: doc?.count ?? 0,
    };
  });
}

const AS_SOURCE: Record<ControlStatus, SourceStatus> = { evidenced: 'pass', gap: 'fail', partial: 'pending', no_evidence: 'none', not_mapped: 'none' };

/** A framework's requirements, each taking the status of the common controls it maps to. */
export function evaluateFramework(key: Framework, requirements: CatalogueRequirement[], common: EvaluatedCommonControl[]): EvaluatedControl[] {
  const byKey = new Map(common.map((c) => [c.key, c]));
  return requirements.map((r) => {
    const ccs = r.controls.map((k) => byKey.get(k)).filter((c): c is EvaluatedCommonControl => !!c);
    if (ccs.length === 0) return { framework: key, id: r.id, title: r.title, status: 'not_mapped' as const, sources: [], controls: [] };
    const sources = ccs.map((c) => ({ label: c.title, status: AS_SOURCE[c.status], href: `/controls?view=common#${c.key}` }));
    return { framework: key, id: r.id, title: r.title, status: rollUp(sources.map((s) => s.status)), sources, controls: ccs.map((c) => c.key) };
  });
}

/** The AIC standard: one entry per requirement that applies to the organisation, evidenced by the vault. */
export function evaluateAic(e: EvidenceInput): EvaluatedControl[] {
  return Object.entries(e.requirements)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([code, r]) => {
      const sources: EvaluatedSource[] = [{ label: 'Evidence filed in the vault', status: vaultStatus(r.state), href: '/evidence' }];
      return { framework: 'aic', id: code, title: r.text, status: rollUp(sources.map((s) => s.status)), sources };
    });
}

/**
 * Every requirement of the AIC standard and of the given frameworks (all of
 * the catalogue by default), evaluated against the organisation's evidence.
 */
export function evaluateControls(
  e: EvidenceInput,
  checkTitle: (k: string) => string,
  policyTitle: (k: string) => string,
  frameworks: { key: Framework; requirements: CatalogueRequirement[] }[] = CATALOGUE,
): EvaluatedControl[] {
  const common = evaluateCommon(e, checkTitle, policyTitle);
  return [...evaluateAic(e), ...frameworks.flatMap((f) => evaluateFramework(f.key, f.requirements, common))];
}

export type Coverage = { total: number; evidenced: number; partial: number; gap: number; noEvidence: number; notMapped: number };

export function coverage(controls: EvaluatedControl[]): Coverage {
  const n = (s: ControlStatus) => controls.filter((c) => c.status === s).length;
  return { total: controls.length, evidenced: n('evidenced'), partial: n('partial'), gap: n('gap'), noEvidence: n('no_evidence'), notMapped: n('not_mapped') };
}
