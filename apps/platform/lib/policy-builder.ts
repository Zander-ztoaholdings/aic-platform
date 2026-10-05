/**
 * Building a policy from a few answers, instead of filling in blanks.
 *
 * Each template asks four to seven questions a manager can answer in two
 * minutes: who owns it, which tools, how fast, how often. Most answers are
 * already in AIC (the organisation's name, its people, its accountable person,
 * the systems it connected), so they arrive pre-filled. The policy text is
 * then assembled from the answers: no "[role]" survives into a draft.
 *
 * The person can still edit every word afterwards. What they cannot do by
 * accident is publish a policy with a placeholder in it.
 *
 * Pure: tested in __tests__/lib/policy-builder.test.ts.
 */

export type BuilderContext = {
  orgName: string;
  people: { name: string; jobTitle: string | null }[];
  accountable: { name: string; jobTitle: string | null } | null;
  /** Connected systems, e.g. ['GitHub', 'Microsoft 365', 'OpenAI', 'Anthropic']. */
  connected: string[];
  contactEmail: string | null;
};

type Option = { value: string; label: string };
export type Question =
  | { kind: 'person'; key: string; label: string; help?: string }
  | { kind: 'choice'; key: string; label: string; help?: string; options: Option[] }
  | { kind: 'multi'; key: string; label: string; help?: string; options: Option[]; allowOther?: boolean }
  | { kind: 'text'; key: string; label: string; help?: string; placeholder?: string };

export type Answers = Record<string, string | string[]>;

export type Builder = {
  questions: Question[];
  defaults: (ctx: BuilderContext) => Answers;
  render: (a: Answers, ctx: BuilderContext) => string;
  /** Promises in this policy AIC checks against connected systems (says-vs-does claim ids). */
  monitored: string[];
};

const person = (p: { name: string; jobTitle: string | null } | null | undefined) => (p ? `${p.name}${p.jobTitle ? ` (${p.jobTitle})` : ''}` : '');
const firstAdminLike = (ctx: BuilderContext, re: RegExp) => ctx.people.find((p) => re.test(p.jobTitle ?? '')) ?? null;
/** Job titles that usually own security. "IT" is matched as a word, in capitals, so "Head of Credit" does not count. */
const SECURITY_LEAD = /\bIT\b|\b(CTO|CIO|CISO)\b|[Tt]echnolog|[Ss]ecurity|[Ii]nformation/;
const s = (a: Answers, k: string) => (typeof a[k] === 'string' ? (a[k] as string).trim() : '');
const list = (a: Answers, k: string) => (Array.isArray(a[k]) ? (a[k] as string[]).map((x) => x.trim()).filter(Boolean) : []);
const months = (v: string) => (v === '12' ? 'twelve months' : v === '6' ? 'six months' : v === '3' ? 'three months' : `${v} months`);

const REVIEW: Option[] = [{ value: '12', label: 'Every 12 months' }, { value: '6', label: 'Every 6 months' }];

// ── AI acceptable use ───────────────────────────────────────────────────────
const AI_TOOLS: Option[] = [
  { value: 'ChatGPT (Team or Enterprise)', label: 'ChatGPT Team or Enterprise' },
  { value: 'Microsoft 365 Copilot', label: 'Microsoft 365 Copilot' },
  { value: 'GitHub Copilot', label: 'GitHub Copilot' },
  { value: 'Claude (Team or Enterprise)', label: 'Claude Team or Enterprise' },
  { value: 'Google Gemini for Workspace', label: 'Gemini for Workspace' },
  { value: 'OpenAI API (for our own systems)', label: 'OpenAI API' },
  { value: 'Anthropic API (for our own systems)', label: 'Anthropic API' },
];

const aiUse: Builder = {
  monitored: ['aiuse.ai_code_reviewed', 'aiuse.agents_via_prs', 'aiuse.declared'],
  questions: [
    { kind: 'person', key: 'owner', label: 'Who keeps the list of approved AI tools and approves new ones?', help: 'One named person. They also receive reports of misuse.' },
    { kind: 'multi', key: 'tools', label: 'Which AI tools are approved today?', help: 'Pre-ticked from the systems you connected. Add any others.', options: AI_TOOLS, allowOther: true },
    { kind: 'choice', key: 'personal', label: 'May staff put customers’ personal information into an approved tool?', options: [
      { value: 'declared', label: 'Only in tools approved for it, with the use recorded in the AI inventory' },
      { value: 'never', label: 'Never' },
    ] },
    { kind: 'choice', key: 'code', label: 'Do your developers use AI to write code?', options: [
      { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
    ] },
    { kind: 'choice', key: 'review', label: 'How often is this policy reviewed?', options: REVIEW },
  ],
  defaults: (ctx) => ({
    owner: person(ctx.accountable) || person(firstAdminLike(ctx, /[Oo]perat|\bCOO\b/)) || person(ctx.people[0]),
    tools: [
      ...(ctx.connected.includes('OpenAI') ? ['OpenAI API (for our own systems)'] : []),
      ...(ctx.connected.includes('Anthropic') ? ['Anthropic API (for our own systems)'] : []),
      ...(ctx.connected.includes('Microsoft 365') ? ['Microsoft 365 Copilot'] : []),
      ...(ctx.connected.includes('GitHub') ? ['GitHub Copilot'] : []),
    ],
    personal: 'declared',
    code: ctx.connected.includes('GitHub') ? 'yes' : 'no',
    review: '12',
  }),
  render: (a, ctx) => {
    const owner = s(a, 'owner');
    const tools = list(a, 'tools');
    return `# AI acceptable use policy

## Purpose
This policy sets out how people at ${ctx.orgName} may use AI tools, including chat assistants, coding assistants and AI features inside other software, so that we get their benefits without exposing customers, colleagues or the business.

## Who it applies to
Everyone who works for or with ${ctx.orgName} and uses an AI tool for work, on any device.

## Approved tools
${tools.length ? `These tools are approved for work:\n\n${tools.map((t) => `- ${t}`).join('\n')}\n\n` : ''}- Only approved tools may be used with work information. ${owner} keeps the approved list and records each tool in our AI inventory on AIC.
- A new tool is approved by ${owner} after checking where it sends data, whether the provider trains on it, and whether it can be used under our data processing terms.
- Personal accounts of approved tools are not to be used for work.

## Information you may not put into an AI tool
${s(a, 'personal') === 'never'
  ? '- Personal information about customers, applicants or employees, in any AI tool.'
  : '- Personal information about customers, applicants or employees, unless the tool is approved for it and the use is recorded in our AI inventory.'}
- Passwords, keys, tokens or any other credential.
- Information marked confidential, or anything you would not send to an outside supplier.

## Decisions about people
- An AI tool may help prepare a decision about a person (for example a credit, hiring or claims decision) only if that use is declared in our AI inventory with a named accountable person.
- No decision with legal or similarly significant effect on a person is made by an AI tool alone. A named person reviews it and can change it.
${s(a, 'code') === 'yes' ? `
## Code written with AI
- AI-written code is reviewed and approved by a person other than the one who prompted it before it is merged.
- AI agents work through pull requests. They do not push directly to protected branches.
` : ''}
## Breaches
Report misuse, or a mistake such as pasting personal information into an unapproved tool, to ${owner} the same day. Reporting early is never held against you.

## Review
${owner} reviews this policy at least every ${months(s(a, 'review') || '12')}, and whenever we adopt a significant new AI tool.`;
  },
};

// ── Human oversight ─────────────────────────────────────────────────────────
const oversight: Builder = {
  monitored: [],
  questions: [
    { kind: 'person', key: 'owner', label: 'Who owns this policy?', help: 'Usually the accountable person for your AI systems.' },
    { kind: 'choice', key: 'when', label: 'When does a person review an adverse decision before it takes effect?', help: 'An adverse decision refuses, limits or prices a service for someone.', options: [
      { value: 'every', label: 'Every adverse decision' },
      { value: 'sample', label: 'A sample, plus every case the person asks about' },
      { value: 'request', label: 'When the person affected asks' },
    ] },
    { kind: 'choice', key: 'days', label: 'How quickly does someone who asks get the reasons for a decision?', options: [
      { value: '5', label: 'Within 5 working days' }, { value: '10', label: 'Within 10 working days' }, { value: '20', label: 'Within 20 working days' },
    ] },
    { kind: 'choice', key: 'rates', label: 'How often are override rates looked at?', options: [
      { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
    ] },
    { kind: 'choice', key: 'review', label: 'How often is this policy reviewed?', options: REVIEW },
  ],
  defaults: (ctx) => ({ owner: person(ctx.accountable) || person(ctx.people[0]), when: 'every', days: '10', rates: 'monthly', review: '12' }),
  render: (a, ctx) => {
    const when = s(a, 'when');
    const whenText = when === 'every' ? 'a trained reviewer reviews every such case before it takes effect'
      : when === 'sample' ? 'a trained reviewer reviews a regular sample of such cases, and every case the person affected asks about, before it takes effect'
      : 'a trained reviewer reviews the case whenever the person affected asks';
    return `# Human oversight of automated decisions

## Purpose
Section 71 of POPIA gives people the right not to be subject to a decision with legal or substantial effect that is based solely on automated processing. This policy sets out how ${ctx.orgName} keeps a person meaningfully involved in every such decision.

## Accountability
- Every AI system that makes or informs a decision about a person is recorded in our AI inventory.
- Each has a named accountable person: an individual, not a role, who has signed AIC's accountable person declaration.
- The accountable person can explain what the system does, what it is not allowed to do, and how a decision can be overridden.

## Review and override
- Where a system's output would refuse, limit or price a service for a person, ${whenText}.
- A reviewer can override the system. Every override records who made it and why.
- Override rates are reviewed ${s(a, 'rates') || 'monthly'} by the accountable person. A rate near zero is investigated: it may mean reviewers are not really reviewing.

## Explanation and correction
- A person affected by a decision can ask for the reasons, and receives them in plain language within ${s(a, 'days') || '10'} working days.
- A person can ask for a decision to be reconsidered by someone who was not involved in the original decision.
- Corrections are recorded, and their causes are fed back to the system's owner.

## Change
A material change to a system (a new model, new data, a new use) is approved by the accountable person before it reaches production, and recorded.

## Review
${s(a, 'owner')} reviews this policy with the accountable persons every ${months(s(a, 'review') || '12')}.`;
  },
};

// ── Information security ────────────────────────────────────────────────────
const infosec: Builder = {
  monitored: ['infosec.second_factor', 'infosec.leavers', 'infosec.few_admins', 'infosec.code_review', 'infosec.vulnerabilities', 'infosec.no_secrets'],
  questions: [
    { kind: 'person', key: 'owner', label: 'Who is responsible for information security?', help: 'They own this policy and receive reports of lost devices.' },
    { kind: 'choice', key: 'access', label: 'How often is everyone’s access reviewed?', options: [
      { value: '3', label: 'Every 3 months' }, { value: '6', label: 'Every 6 months' }, { value: '12', label: 'Every 12 months' },
    ] },
    { kind: 'choice', key: 'vault', label: 'Where are passwords kept?', options: [
      { value: '1Password', label: '1Password' }, { value: 'Bitwarden', label: 'Bitwarden' }, { value: 'Keeper', label: 'Keeper' },
      { value: 'LastPass', label: 'LastPass' }, { value: 'our company password manager', label: 'Another password manager' },
    ] },
    { kind: 'choice', key: 'patch', label: 'How fast are known critical vulnerabilities fixed?', options: [
      { value: '7', label: 'Within 7 days' }, { value: '14', label: 'Within 14 days' }, { value: '30', label: 'Within 30 days' },
    ] },
    { kind: 'choice', key: 'code', label: 'Do you build or change software yourselves?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { kind: 'choice', key: 'review', label: 'How often is this policy reviewed?', options: REVIEW },
  ],
  defaults: (ctx) => ({
    owner: person(firstAdminLike(ctx, SECURITY_LEAD)) || person(ctx.accountable) || person(ctx.people[0]),
    access: '6', vault: '', patch: '14', code: ctx.connected.includes('GitHub') ? 'yes' : 'no', review: '12',
  }),
  render: (a, ctx) => `# Information security policy

## Purpose
POPIA section 19 requires ${ctx.orgName} to secure the personal information it holds with reasonable technical and organisational measures. This policy sets those measures.

## Access
- People get access to the systems and information their work needs, and no more.
- Access is removed on the day someone leaves, and reviewed for everyone at least every ${months(s(a, 'access') || '6')}.
- Administrator rights are held by as few people as possible, and never used for everyday work.

## Sign-in
- Every account uses a second factor (an authenticator app or a security key) wherever the system supports it.
- Passwords are unique per system and kept in ${s(a, 'vault') || 'our company password manager'}.

## Devices
- Work devices have disk encryption, automatic updates and a screen lock on.
- A lost or stolen device is reported to ${s(a, 'owner')} immediately.

## Software${s(a, 'code') === 'yes' ? ' and code' : ''}
${s(a, 'code') === 'yes' ? '- Changes to production systems go through review by someone other than their author.\n' : ''}- ${s(a, 'code') === 'yes' ? 'Dependencies are' : 'Software is'} kept up to date, and known critical vulnerabilities are fixed within ${s(a, 'patch') || '14'} days.
${s(a, 'code') === 'yes' ? '- Credentials never go into code repositories. A leaked credential is rotated immediately.\n' : ''}
## Suppliers
Suppliers who handle personal information on our behalf sign a written agreement that requires them to protect it (POPIA sections 20 and 21).

## Review
${s(a, 'owner')} reviews this policy every ${months(s(a, 'review') || '12')}.`,
};

// ── Incident response ───────────────────────────────────────────────────────
const incident: Builder = {
  monitored: [],
  questions: [
    { kind: 'person', key: 'lead', label: 'Who leads the response to a security incident?' },
    { kind: 'text', key: 'contact', label: 'How do people report an incident?', help: 'An address or number that is watched, including after hours if you can.', placeholder: 'e.g. security@yourcompany.co.za or 082 000 0000' },
    { kind: 'choice', key: 'notify', label: 'When do you notify the Information Regulator and the people affected?', options: [
      { value: 'asap72', label: 'As soon as reasonably possible, and aim for within 72 hours' },
      { value: 'asap', label: 'As soon as reasonably possible (the words of POPIA section 22)' },
    ] },
    { kind: 'choice', key: 'clients', label: 'Do you process information on behalf of clients?', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { kind: 'choice', key: 'review', label: 'How often is this policy reviewed?', options: REVIEW },
  ],
  defaults: (ctx) => ({
    lead: person(firstAdminLike(ctx, SECURITY_LEAD)) || person(ctx.accountable) || person(ctx.people[0]),
    contact: ctx.contactEmail ?? '', notify: 'asap72', clients: 'no', review: '12',
  }),
  render: (a) => `# Security incident response policy

## What counts as an incident
Anything that may have exposed, changed or lost information we hold, including a lost device, a leaked password or key, a phishing click, data sent to the wrong person, or a system acting outside its declared purpose.

## Report it
Anyone who notices an incident tells ${s(a, 'lead')} at ${s(a, 'contact')} straight away. Do not try to investigate on your own first.

## Respond
- ${s(a, 'lead')} leads the response. The first steps are to stop it getting worse: revoke or rotate credentials, disable affected accounts, isolate affected systems.
- Everything done is written down with the time it was done.

## Notify
- If personal information was, or may have been, accessed or acquired by an unauthorised person, we notify the Information Regulator and the people affected as soon as reasonably possible, as POPIA section 22 requires${s(a, 'notify') === 'asap72' ? ', and we aim to do so within 72 hours of becoming aware of it' : ''}.
${s(a, 'clients') === 'yes' ? '- Where we process information for a client, we tell that client without undue delay so they can meet their own obligations.\n' : ''}
## Learn
Within two weeks of an incident, ${s(a, 'lead')} writes a short account of what happened, why, and what we changed so it cannot happen the same way again.

## Review
${s(a, 'lead')} reviews this policy every ${months(s(a, 'review') || '12')}, and after every significant incident.`,
};

export const BUILDERS: Record<string, Builder> = {
  'ai-acceptable-use': aiUse,
  'human-oversight': oversight,
  'information-security': infosec,
  'incident-response': incident,
};

/** The questions still unanswered, by label. A policy is only drafted when this is empty. */
export function missingAnswers(b: Builder, a: Answers): string[] {
  return b.questions.filter((q) => (q.kind === 'multi' ? false : !s(a, q.key))).map((q) => q.label);
}

/** Cleans answers from a request: only known keys, strings trimmed and capped. */
export function cleanAnswers(b: Builder, raw: unknown): Answers {
  const o = (raw ?? {}) as Record<string, unknown>;
  const out: Answers = {};
  for (const q of b.questions) {
    const v = o[q.key];
    if (q.kind === 'multi') out[q.key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 20) : [];
    else if (typeof v === 'string') {
      const t = v.trim().slice(0, 200).replace(/[\r\n#]/g, ' ');
      if (q.kind === 'choice' && !q.options.some((x) => x.value === t)) continue;
      out[q.key] = t;
    }
  }
  return out;
}

/** True when the text still has a "[placeholder]" in it. */
export const hasPlaceholder = (body: string) => /\[[^\]\n]{2,60}\](?!\()/.test(body);
