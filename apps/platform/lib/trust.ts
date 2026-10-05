/**
 * Trust pages: an organisation's public page, which it sends to customers
 * instead of answering the same questions again.
 *
 * Every item says who stands behind it. "Issued by AIC" for the badge and
 * the certificate (AIC can revoke those, and the page reflects it at once).
 * "Observed by AIC" for what the connectors read. "Declared by <organisation>"
 * for everything the organisation states about itself. A reader can always
 * tell a verified fact from a claim; that distinction is the product.
 *
 * Pure (apart from types): tested in __tests__/lib/trust.test.ts.
 */

import type { OrgFacts } from './org-facts';
import type { EvaluatedControl } from './controls';
import { FRAMEWORKS } from './controls';
import { CHECK_BY_KEY } from './integrations/catalog';

export const SECTION_KEYS = ['badge', 'certificate', 'accountable_person', 'policies', 'frameworks', 'monitoring', 'systems'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export type Sections = Record<SectionKey, boolean>;

export const SECTION_LABELS: Record<SectionKey, { title: string; help: string }> = {
  badge: { title: 'AIC Aware badge', help: 'Your current badge and its code, verifiable on aiccertified.cloud.' },
  certificate: { title: 'AIC certificate', help: 'Your certificate, if one has been issued. Suspension or revocation shows here at once.' },
  accountable_person: { title: 'Accountable person', help: 'The name and job title of the person who signed the accountability declaration.' },
  policies: { title: 'Published policies', help: 'Titles, version numbers and how many of your people have accepted each. Not the text.' },
  frameworks: { title: 'Framework coverage', help: 'How many controls in each framework have evidence, without detail of the gaps.' },
  monitoring: { title: 'Continuous monitoring', help: 'Which systems AIC reads, and how many automated checks pass, by area.' },
  systems: { title: 'AI systems', help: 'The names and purposes of the AI systems you have declared.' },
};

export const DEFAULT_SECTIONS: Sections = {
  badge: true, certificate: true, accountable_person: true, policies: true, frameworks: true, monitoring: false, systems: false,
};

export function normaliseSections(raw: unknown): Sections {
  const out = { ...DEFAULT_SECTIONS };
  if (raw && typeof raw === 'object') {
    for (const k of SECTION_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'boolean') out[k] = v;
    }
  }
  return out;
}

export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,78}[a-z0-9])?$/;
export const RESERVED_SLUGS = new Set(['aic', 'admin', 'api', 'login', 'settings', 'new', 'edit', 'trust', 'preview']);

export function suggestSlug(name: string) {
  return name.toLowerCase()
    .replace(/\((pty|proprietary)\)|\b(ltd|limited|inc|llc|pty)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'organisation';
}

export interface TrustView {
  name: string;
  intro: string | null;
  contactEmail: string | null;
  updatedAt: string;
  badge?: OrgFacts['badge'];
  certificate?: OrgFacts['certificate'];
  accountablePerson?: OrgFacts['accountablePerson'];
  policies?: OrgFacts['policies'];
  frameworks?: { key: string; name: string; evidenced: number; total: number }[];
  monitoring?: { connectors: string[]; areas: { area: string; passing: number; total: number }[]; lastChecked: string | null };
  systems?: OrgFacts['systems'];
}

const AREA: Record<string, string> = { github: 'Code and change control', microsoft: 'Identity and sign-in', ai_provider: 'AI model usage' };

export function buildTrustView(facts: OrgFacts, sections: Sections, controls: EvaluatedControl[], page: { intro: string | null; contactEmail: string | null; updatedAt: string }): TrustView {
  const v: TrustView = { name: facts.org.legalName || facts.org.name, intro: page.intro, contactEmail: page.contactEmail, updatedAt: page.updatedAt };
  if (sections.badge && facts.badge) v.badge = facts.badge;
  if (sections.certificate && facts.certificate) v.certificate = facts.certificate;
  if (sections.accountable_person && facts.accountablePerson) v.accountablePerson = facts.accountablePerson;
  if (sections.policies && facts.policies.length) v.policies = facts.policies;
  if (sections.frameworks && controls.length) {
    v.frameworks = FRAMEWORKS.map((f) => {
      const cs = controls.filter((c) => c.framework === f.key);
      return { key: f.key, name: f.name, evidenced: cs.filter((c) => c.status === 'evidenced').length, total: cs.length };
    }).filter((f) => f.total > 0);
  }
  if (sections.monitoring && facts.connectors.length) {
    const areas = new Map<string, { passing: number; total: number }>();
    for (const c of facts.checks) {
      const src = CHECK_BY_KEY[c.key]?.source;
      if (!src || c.status === 'unknown') continue;
      const a = AREA[src] ?? src;
      const cur = areas.get(a) ?? { passing: 0, total: 0 };
      cur.total += 1;
      if (c.status === 'pass') cur.passing += 1;
      areas.set(a, cur);
    }
    const last = facts.connectors.map((c) => c.lastChecked).filter(Boolean).sort().pop() ?? null;
    v.monitoring = { connectors: facts.connectors.map((c) => c.provider), areas: [...areas].map(([area, x]) => ({ area, ...x })), lastChecked: last };
  }
  if (sections.systems && facts.systems.length) v.systems = facts.systems;
  return v;
}
