/**
 * A language model's draft for questionnaire questions the rules cannot place.
 *
 * The model sees only the organisation's own record, as numbered facts, and
 * must answer from those facts or say what is missing. Its draft is labelled
 * as such, lists the record it drew on, and still needs a named person's
 * approval before it can be exported. AIC never presents it as verified.
 */
import type { OrgFacts } from '../org-facts';
import type { Draft, Source } from '../questionnaire';
import { askJson } from './claude';

export type RecordControl = { key: string; title: string; status: string; documents: number };

type Fact = { id: string; text: string; source: Source };

const SRC = {
  policies: { label: 'Policies', href: '/policies' },
  checks: { label: 'Automated checks', href: '/checks' },
  estate: { label: 'AI estate', href: '/overview' },
  decisions: { label: 'Decision log', href: '/pulse' },
  controls: { label: 'Controls', href: '/controls?view=common' },
  certificate: { label: 'My certificate', href: '/certificate' },
  aware: { label: 'AIC Aware', href: '/aware' },
};

const STATUS_WORDS: Record<string, string> = {
  evidenced: 'evidenced (all evidence AIC can see is positive)',
  partial: 'partly evidenced',
  gap: 'has a gap (something AIC can see is failing)',
  no_evidence: 'no evidence on record',
};

/** The organisation's record as short numbered facts. Pure; tested. */
export function recordFacts(f: OrgFacts, controls: RecordControl[] = []): Fact[] {
  const out: Fact[] = [];
  const add = (prefix: string, text: string, source: Source) => out.push({ id: `${prefix}${out.filter((x) => x.id.startsWith(prefix)).length + 1}`, text, source });
  add('O', `Organisation: ${f.org.legalName || f.org.name}${f.org.division ? `, AIC Division ${f.org.division}` : ''}.`, SRC.certificate);
  if (f.accountablePerson) add('A', `Accountable person for AI: ${f.accountablePerson.name}${f.accountablePerson.jobTitle ? `, ${f.accountablePerson.jobTitle}` : ''}, declared ${f.accountablePerson.since.slice(0, 10)}.`, SRC.estate);
  for (const p of f.policies) add('P', `Published policy: ${p.title}, version ${p.version}${p.publishedAt ? `, published ${p.publishedAt.slice(0, 10)}` : ''}, accepted by ${p.accepted} of ${p.members} staff.`, SRC.policies);
  for (const c of f.checks.filter((x) => x.status !== 'unknown').slice(0, 40)) add('K', `Automated check on ${c.subject}: ${c.status}. ${c.summary}`, SRC.checks);
  if (f.connectors.length) add('N', `Systems AIC reads with read-only access: ${f.connectors.map((c) => c.label || c.provider).join(', ')}.`, SRC.checks);
  if (f.systems.length) add('S', `AI systems in the inventory (${f.systems.length}): ${f.systems.slice(0, 12).map((s) => `${s.name}${s.purpose ? ` (${s.purpose})` : ''}`).join('; ')}.`, SRC.estate);
  add('D', `Decisions recorded with AIC in the last 90 days: ${f.decisions.last90}, of which ${f.decisions.overrides} were overridden by a person.`, SRC.decisions);
  if (f.certificate) add('X', `AIC certificate ${f.certificate.number}: ${f.certificate.status}${f.certificate.expires ? `, expires ${f.certificate.expires.slice(0, 10)}` : ''}.`, SRC.certificate);
  if (f.badge) add('B', `AIC Aware badge ${f.badge.code}: ${f.badge.status}, expires ${f.badge.expiresAt.slice(0, 10)}.`, SRC.aware);
  for (const c of controls.filter((x) => x.status !== 'no_evidence')) {
    add('C', `Control "${c.title}": ${STATUS_WORDS[c.status] ?? c.status}${c.documents ? `; ${c.documents} document(s) filed` : ''}.`, SRC.controls);
  }
  return out;
}

const SYSTEM = `You draft answers to a buyer's security and AI questionnaire on behalf of the organisation described in the record.

Rules:
- Use ONLY the numbered facts in the record. Never invent a control, certification, number, date, product, supplier or practice.
- If a fact shows a check failing or a gap, do not claim the opposite. Say what the record shows.
- If the record does not answer the question, set "status" to "needs_input", leave "answer" empty, and in "missing" say in one sentence what the organisation must supply.
- Write as the organisation ("we"), in plain English, at most 120 words. No marketing language.
- List in "used" the ids of every fact your answer relies on.

Reply with JSON only: {"answer": string, "used": string[], "status": "draft" | "needs_input", "missing": string}`;

const NOTE = 'AI DRAFT: written by a language model from the record listed below. Check every claim before approving.';

/** A draft for one question, or null if the model fails (the caller keeps the rule-based draft). */
export async function aiDraftAnswer(question: string, facts: Fact[]): Promise<Draft | null> {
  try {
    const r = await askJson<{ answer?: string; used?: string[]; status?: string; missing?: string }>({
      system: SYSTEM,
      content: [{ type: 'text', text: `Record:\n${facts.map((f) => `[${f.id}] ${f.text}`).join('\n')}\n\nQuestion: ${question}` }],
      maxTokens: 600,
    });
    const byId = new Map(facts.map((f) => [f.id, f]));
    const used = (r.used ?? []).filter((id) => byId.has(id));
    const sources: Source[] = [];
    for (const id of used) { const s = byId.get(id)!.source; if (!sources.some((x) => x.href === s.href)) sources.push(s); }
    const answer = (r.answer ?? '').trim();
    if (r.status === 'needs_input' || !answer || used.length === 0) {
      const missing = (r.missing ?? '').trim();
      return { topic: 'ai', draft: `AIC holds nothing on record that answers this question.${missing ? `\n\nADD: ${missing}` : ''}`, sources, status: 'needs_input' };
    }
    return { topic: 'ai', draft: `${answer}\n\n${NOTE}`, sources, status: 'draft' };
  } catch (e) {
    console.error('[QUESTIONNAIRE_AI]', e instanceof Error ? e.message : e);
    return null;
  }
}

/** At most this many questions per questionnaire go to the model; the rest keep the rule-based draft. */
export const AI_QUESTION_CAP = 80;
