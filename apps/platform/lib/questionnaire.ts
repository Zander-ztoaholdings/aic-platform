/**
 * Answering a buyer's security questionnaire from the organisation's own
 * record.
 *
 * Each question is matched to a topic, and the draft is assembled only from
 * what AIC holds: published policies (with version and acceptance), connector
 * checks (with what they last showed), the AI inventory, the decision log, and
 * what AIC issued. Where the record cannot answer, the draft says so and the
 * item is marked "needs input" rather than inventing a plausible sentence.
 * Where a check contradicts the policy, the draft says that too, so nobody
 * sends a buyer a claim their own systems disprove.
 *
 * Every answer is the organisation's statement and must be approved by a
 * named person before it is exported. AIC never presents it as verified.
 *
 * Pure: tested in __tests__/lib/questionnaire.test.ts.
 */

import type { OrgFacts } from './org-facts';

export interface Source { label: string; href: string }
export interface Draft { topic: string; draft: string; sources: Source[]; status: 'draft' | 'needs_input' }

/** One question per line; a pasted spreadsheet column, a numbered list or CSV all work. */
export function parseQuestions(text: string): string[] {
  const out: string[] = [];
  for (let line of text.replace(/\r/g, '').split('\n')) {
    line = line.trim();
    if (!line) continue;
    // CSV: take the first cell, honouring quotes.
    if (line.startsWith('"')) {
      const m = line.match(/^"((?:[^"]|"")*)"/);
      if (m) line = m[1].replace(/""/g, '"');
    } else if (line.includes('\t')) {
      line = line.split('\t')[0];
    }
    line = line.replace(/^(q(uestion)?\s*)?\d+[.):\s-]+\s*/i, '').trim();
    if (!line || /^(question|questions|#|no\.?)$/i.test(line)) continue;
    if (line.length < 8) continue;
    out.push(line.slice(0, 2000));
  }
  return out.slice(0, 500);
}

const pol = (f: OrgFacts, key: string) => f.policies.find((p) => p.key === key);
const polRef = (p: { title: string; version: number; accepted: number; members: number }) =>
  `our ${p.title} (version ${p.version}, accepted by ${p.accepted} of ${p.members} staff)`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const checksFor = (f: OrgFacts, keys: string[]) => f.checks.filter((c) => keys.includes(c.key) && c.status !== 'unknown');

function observed(f: OrgFacts, keys: string[], good: string): { text: string; failing: string[] } {
  const rows = checksFor(f, keys);
  if (!rows.length) return { text: '', failing: [] };
  const failing = rows.filter((r) => r.status === 'fail' || r.status === 'warn');
  if (!failing.length) {
    const when = rows.map((r) => r.observedAt).filter(Boolean).sort().pop() ?? null;
    return { text: ` ${good}${when ? ` (observed by AIC's read-only connection on ${fmt(when)})` : ''}.`, failing: [] };
  }
  return { text: '', failing: failing.map((r) => `${r.subject}: ${r.summary}`) };
}

function finish(topic: string, parts: string[], sources: Source[], failing: string[], gaps: string[]): Draft {
  let draft = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const needs = failing.length > 0 || gaps.length > 0 || !draft;
  const notes: string[] = [];
  if (failing.length) notes.push(`CHECK BEFORE SENDING: AIC's latest checks contradict this: ${failing.slice(0, 3).join('; ')}. Fix the practice or change the answer.`);
  if (gaps.length) notes.push(`ADD: ${gaps.join(' ')}`);
  if (!draft) draft = 'AIC holds nothing on record that answers this question. Write the answer yourself.';
  return { topic, draft: notes.length ? `${draft}\n\n${notes.join('\n')}` : draft, sources, status: needs ? 'needs_input' : 'draft' };
}

const S = {
  policies: { label: 'Policies', href: '/policies' },
  checks: { label: 'Automated checks', href: '/checks' },
  estate: { label: 'AI estate', href: '/overview' },
  decisions: { label: 'Decision log', href: '/pulse' },
  controls: { label: 'Controls', href: '/controls' },
  certificate: { label: 'My certificate', href: '/certificate' },
  aware: { label: 'AIC Aware', href: '/aware' },
};

type Topic = { key: string; re: RegExp; draft: (f: OrgFacts, question: string) => Draft };

export const TOPICS: Topic[] = [
  { key: 'encryption', re: /encrypt|tls\b|ssl\b|at rest|in transit|cryptograph/i,
    draft: () => finish('encryption', [], [], [], ['AIC does not observe encryption settings. Describe encryption at rest and in transit for the systems in scope.']) },
  { key: 'backup', re: /backup|back-up|disaster recovery|business continuity|\bbcp\b|\bdrp\b|\brto\b|\brpo\b|restore/i,
    draft: () => finish('backup', [], [], [], ['AIC does not observe backups. Describe backup frequency, where copies are held, and when a restore was last tested.']) },
  { key: 'automated_decisions', re: /automated decision|human (review|oversight|intervention|in the loop)|section 71|profiling|solely automated|override/i,
    draft: (f) => {
      const p = pol(f, 'human-oversight');
      const parts = [
        p ? `Yes. ${cap(polRef(p))} sets out how a person stays meaningfully involved in every decision with legal or similarly significant effect, in line with POPIA section 71: each such AI system has a named accountable person, a reviewer can override any decision, and every override records who made it and why.` : '',
        f.accountablePerson ? `Our accountable person is ${f.accountablePerson.name}${f.accountablePerson.jobTitle ? `, ${f.accountablePerson.jobTitle}` : ''}, who signed AIC's accountable person declaration on ${fmt(f.accountablePerson.since)}.` : '',
        f.decisions.last90 > 0 ? `Our systems recorded ${f.decisions.last90.toLocaleString('en-ZA')} decisions with AIC in the last 90 days, of which ${f.decisions.overrides.toLocaleString('en-ZA')} were overridden by a person.` : '',
      ];
      const gaps = [];
      if (!p) gaps.push('Publish the Human oversight policy on AIC, or describe your review process.');
      if (!f.accountablePerson) gaps.push('Name the accountable person.');
      return finish('automated_decisions', parts, [S.policies, S.decisions], [], gaps);
    } },
  { key: 'ai_data', re: /train(ed|ing)? (on|with)|(customer|personal|client) (data|information).*(ai|model|llm)|(ai|model|llm).*(customer|personal|client) (data|information)|prompts?\b/i,
    draft: (f) => {
      const p = pol(f, 'ai-acceptable-use');
      return finish('ai_data', [
        p ? `${cap(polRef(p))} prohibits putting personal information about customers, applicants or employees into an AI tool unless that tool is approved for it and the use is recorded in our AI inventory, and prohibits personal accounts of AI tools for work.` : '',
      ], [S.policies], [], [p ? 'State whether each AI provider you use may train on your data, and under which terms.' : 'Publish the AI acceptable use policy on AIC, or describe your rules.']);
    } },
  { key: 'ai_usage', re: /\bai\b|artificial intelligence|machine learning|\bml\b|\bllms?\b|\bgpt|generative|language model|copilot|chatgpt/i,
    draft: (f) => {
      const p = pol(f, 'ai-acceptable-use');
      const sys = f.systems.length ? `We keep an inventory of the AI systems we use with AIC; it currently lists ${f.systems.length}: ${f.systems.slice(0, 5).map((s) => s.name).join(', ')}${f.systems.length > 5 ? ', and others' : ''}.` : '';
      const o = observed(f, ['ai.models_declared', 'github.ai_usage_declared'], 'AIC checks our connected systems and AI providers for AI use that is not in the inventory, and currently finds none undeclared');
      return finish('ai_usage', [
        sys,
        p ? `Use of AI tools is governed by ${polRef(p)}.` : '',
        f.badge && f.badge.status === 'valid' ? `We hold a current AIC Aware badge (${f.badge.code}), a declaration by our named accountable person, verifiable at aiccertified.cloud.` : '',
        o.text,
      ], [S.estate, S.policies, S.checks], o.failing, f.systems.length ? [] : ['Declare your AI systems on AIC, or list them here.']);
    } },
  { key: 'mfa', re: /multi.?factor|\bmfa\b|\b2fa\b|two.?factor|two.?step|second factor|strong authentication/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      const o = observed(f, ['m365.mfa_enforced', 'm365.mfa_registered', 'github.org_2fa_required'], 'Multi-factor authentication is enforced and registered for our people');
      return finish('mfa', [p ? `Yes. ${cap(polRef(p))} requires a second factor for every account wherever the system supports it.` : '', o.text], [S.policies, S.checks], o.failing, p || o.text ? [] : ['Describe how multi-factor authentication is enforced.']);
    } },
  { key: 'privileged', re: /privileged|admin(istrator|istrative)? (rights|access|accounts?)|global admin|superuser/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      const o = observed(f, ['m365.global_admins'], 'Administrator rights are held by a small, named group');
      return finish('privileged', [p ? `${cap(polRef(p))} limits administrator rights to as few people as possible and prohibits their use for everyday work.` : '', o.text], [S.policies, S.checks], o.failing, p ? [] : ['Describe how administrator access is limited.']);
    } },
  { key: 'access', re: /access (control|review|management|rights)|least privilege|need.to.know|leaver|offboard|terminat|deprovision|joiner|mover/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      const o = observed(f, ['m365.stale_accounts'], 'No enabled account has gone unused for 90 days');
      return finish('access', [p ? `${cap(polRef(p))} grants people only the access their work needs, removes access on the day someone leaves, and reviews everyone's access periodically.` : '', o.text], [S.policies, S.checks], o.failing, p ? [] : ['Describe how access is granted, reviewed and removed.']);
    } },
  { key: 'change', re: /code review|change (management|control)|pull request|peer review|\bsdlc\b|secure (software )?development|four.eyes|segregation of duties|deploy/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      const ai = pol(f, 'ai-acceptable-use');
      const o = observed(f, ['github.branch_protected', 'github.review_required', 'github.merged_with_review', 'github.ai_changes_reviewed'], 'Our main branches are protected and every change merged recently was approved by someone other than its author, including changes written with AI');
      return finish('change', [
        p ? `${cap(polRef(p))} requires every change to production systems to be reviewed by someone other than its author.` : '',
        ai ? `${cap(polRef(ai))} applies the same rule to code written with AI, and requires AI agents to work through pull requests.` : '',
        o.text,
      ], [S.policies, S.checks], o.failing, p || o.text ? [] : ['Describe how changes are reviewed and approved.']);
    } },
  { key: 'vulnerabilities', re: /vulnerab|patch(ing)?\b|\bcve\b|dependenc|penetration|pen.?test|scanning/i,
    draft: (f, question) => {
      const p = pol(f, 'information-security');
      const o = observed(f, ['github.no_critical_vulnerabilities'], 'There are no open critical or high-severity dependency alerts in our connected repositories');
      return finish('vulnerabilities', [p ? `${cap(polRef(p))} requires dependencies to be kept up to date and known critical vulnerabilities to be fixed promptly.` : '', o.text], [S.policies, S.checks], o.failing,
        /penetration|pen.?test/i.test(question) ? ['Add when the last penetration test was done, by whom, and whether findings were fixed; AIC does not observe this.'] : p || o.text ? [] : ['Describe how vulnerabilities are found and fixed.']);
    } },
  { key: 'secrets', re: /secret|credential|api key|hard.?coded|password (storage|manager)/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      const o = observed(f, ['github.no_exposed_secrets'], 'There are no open leaked-secret alerts in our connected repositories');
      return finish('secrets', [p ? `${cap(polRef(p))} prohibits credentials in code repositories and requires a leaked credential to be rotated immediately.` : '', o.text], [S.policies, S.checks], o.failing, p ? [] : ['Describe how credentials are stored and rotated.']);
    } },
  { key: 'incident', re: /incident|breach|compromise|notif(y|ication)|section 22/i,
    draft: (f) => {
      const p = pol(f, 'incident-response');
      return finish('incident', [p ? `Yes. ${cap(polRef(p))} sets out how incidents are reported, contained and recorded, and requires us to notify the Information Regulator and affected people as soon as reasonably possible where personal information may have been accessed by an unauthorised person (POPIA section 22), and to tell clients without undue delay where we process information for them.` : ''], [S.policies], [], p ? [] : ['Publish the Incident response policy on AIC, or describe your process.']);
    } },
  { key: 'supplier', re: /vendor|supplier|third.?part|sub.?processor|outsourc/i,
    draft: (f) => {
      const p = pol(f, 'information-security');
      return finish('supplier', [p ? `${cap(polRef(p))} requires suppliers who handle personal information on our behalf to sign a written agreement requiring them to protect it, as POPIA sections 20 and 21 require.` : ''], [S.policies], [], ['List the suppliers in scope, or say how the list can be obtained.']);
    } },
  { key: 'certification', re: /certif|iso\s?\d|iso\/iec|soc\s?2|attest|accredit|compliance framework|audit(ed|or)?\b/i,
    draft: (f) => {
      const parts = [
        f.certificate && f.certificate.status === 'ACTIVE' ? `We hold AIC certificate ${f.certificate.number} (${f.certificate.standard ?? 'AIC standard'}), valid until ${fmt(f.certificate.expires)}, verifiable at aiccertified.cloud.` : '',
        f.badge && f.badge.status === 'valid' ? `We hold a current AIC Aware badge (${f.badge.code}), verifiable at aiccertified.cloud.` : '',
      ];
      return finish('certification', parts, [S.certificate, S.aware, S.controls], [], ['State any other certifications or attestations you hold (for example ISO/IEC 27001 or SOC 2). AIC records only its own.']);
    } },
  { key: 'logging', re: /\blog(s|ging)?\b|monitor|audit trail|siem|alert/i,
    draft: (f) => {
      const parts = [
        f.connectors.length ? `AIC monitors ${f.connectors.map((c) => c.provider).join(', ')} through read-only connections and re-checks them every night.` : '',
        f.decisions.last90 > 0 ? 'Decisions made or informed by our AI systems are logged with AIC in a tamper-evident record, where each entry is chained to the one before it.' : '',
      ];
      return finish('logging', parts, [S.checks, S.decisions], [], ['Describe your own security logging and retention; AIC does not observe it.']);
    } },
  { key: 'training', re: /training|awareness|acknowledg|attest(ation)? by staff|induction/i,
    draft: (f) => {
      const parts = f.policies.length ? [`Staff accept each published policy in AIC, by name and version: ${f.policies.map((p) => `${p.title} (${p.accepted} of ${p.members})`).join('; ')}.`] : [];
      return finish('training', parts, [S.policies], [], ['Describe any security or AI awareness training beyond policy acceptance.']);
    } },
  { key: 'policies', re: /polic(y|ies)|governance|framework/i,
    draft: (f) => finish('policies', [f.policies.length ? `We maintain these published policies, each with a version history and a record of which staff accepted which version: ${f.policies.map((p) => `${p.title} (version ${p.version})`).join('; ')}.` : ''], [S.policies], [], f.policies.length ? [] : ['Publish your policies on AIC, or list them here.']) },
  { key: 'privacy', re: /popia|gdpr|privacy|personal information|information officer|data protection officer|\bdpo\b|data subject/i,
    draft: (f) => {
      const covered: string[] = [];
      if (pol(f, 'information-security')) covered.push('security safeguards (section 19) and operators (sections 20 and 21) in our Information security policy');
      if (pol(f, 'incident-response')) covered.push('breach notification (section 22) in our Incident response policy');
      if (pol(f, 'human-oversight')) covered.push('automated decisions (section 71) in our Human oversight policy');
      return finish('privacy', [covered.length ? `Our published policies address POPIA's ${covered.join('; ')}.` : ''], [S.policies], [], ['Name your Information Officer and state whether they are registered with the Information Regulator.']);
    } },
];

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function draftAnswer(question: string, facts: OrgFacts): Draft {
  const t = TOPICS.find((x) => x.re.test(question));
  if (!t) return { topic: 'other', draft: 'AIC holds nothing on record that answers this question. Write the answer yourself.', sources: [], status: 'needs_input' };
  return t.draft(facts, question);
}

/** CSV with a header row, quoted per RFC 4180. Only approved answers carry an answer. */
export function toCsv(items: { question: string; answer: string | null; status: string; approvedBy: string | null; approvedAt: string | null }[]) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = [['Question', 'Answer', 'Status', 'Approved by', 'Approved on']];
  for (const i of items) {
    rows.push([i.question, i.status === 'approved' ? (i.answer ?? '') : '', i.status === 'approved' ? 'Approved' : 'Not yet approved', i.approvedBy ?? '', i.approvedAt ? i.approvedAt.slice(0, 10) : '']);
  }
  return rows.map((r) => r.map(q).join(',')).join('\r\n');
}
