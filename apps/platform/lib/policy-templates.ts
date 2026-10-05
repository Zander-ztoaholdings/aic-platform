/**
 * Starting points for the policies the AIC standard and the connected-system
 * checks expect an organisation to have. Each is written to be adapted: the
 * square-bracketed parts must be filled in, and the rest edited to describe
 * what the organisation actually does. A policy nobody follows is worse than
 * none, because it is evidence of the gap.
 *
 * Plain text with a small subset of Markdown: "# " and "## " headings, "- "
 * bullets, and blank lines between paragraphs.
 */

export type PolicyTemplate = { key: string; title: string; summary: string; controls: string[]; body: string };

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    key: 'ai-acceptable-use',
    title: 'AI acceptable use policy',
    summary: 'Which AI tools staff may use, for what, and with which information.',
    controls: ['ISO 42001 A.2.2', 'ISO 42001 A.9.2', 'EU AI Act Art. 4', 'ISO 27001 A.5.10', 'AIC HU-3', 'POPIA s19'],
    body: `# AI acceptable use policy

## Purpose
This policy sets out how people at [Organisation] may use AI tools, including chat assistants, coding assistants and AI features inside other software, so that we get their benefits without exposing customers, colleagues or the business.

## Who it applies to
Everyone who works for or with [Organisation] and uses an AI tool for work, on any device.

## Approved tools
- Only tools on the approved list may be used with work information. The list is kept by [role] at [location].
- A new tool is approved by [role] after checking where it sends data, whether the provider trains on it, and whether it can be used under our data processing terms.
- Personal accounts of approved tools are not to be used for work.

## Information you may not put into an AI tool
- Personal information about customers, applicants or employees, unless the tool is approved for it and the use is recorded in our AI inventory.
- Passwords, keys, tokens or any other credential.
- Information marked confidential, or anything you would not send to an outside supplier.

## Decisions about people
- An AI tool may help prepare a decision about a person (for example a credit, hiring or claims decision) only if that use is declared in our AI inventory with a named accountable person.
- No decision with legal or similarly significant effect on a person is made by an AI tool alone. A named person reviews it and can change it.

## Code written with AI
- AI-written code is reviewed and approved by a person other than the one who prompted it before it is merged.
- AI agents work through pull requests. They do not push directly to protected branches.

## Breaches
Report misuse, or a mistake such as pasting personal information into an unapproved tool, to [role] the same day. Reporting early is never held against you.

## Review
[Role] reviews this policy at least every twelve months, and whenever we adopt a significant new AI tool.`,
  },
  {
    key: 'human-oversight',
    title: 'Human oversight of automated decisions',
    summary: 'Who is accountable for each AI system, and how a person can review and override a decision.',
    controls: ['POPIA s71', 'EU AI Act Art. 14', 'ISO 42001 A.2.2', 'AIC HU-1', 'AIC HU-2', 'AIC HU-4', 'AIC CO-1'],
    body: `# Human oversight of automated decisions

## Purpose
Section 71 of POPIA gives people the right not to be subject to a decision with legal or substantial effect that is based solely on automated processing. This policy sets out how [Organisation] keeps a person meaningfully involved in every such decision.

## Accountability
- Every AI system that makes or informs a decision about a person is recorded in our AI inventory.
- Each has a named accountable person: an individual, not a role, who has signed AIC's accountable person declaration.
- The accountable person can explain what the system does, what it is not allowed to do, and how a decision can be overridden.

## Review and override
- Where a system's output would refuse, limit or price a service for a person, a trained reviewer [describe when: every case / a sample / on request] reviews the case before it takes effect.
- A reviewer can override the system. Every override records who made it and why.
- Override rates are reviewed monthly by the accountable person. A rate near zero is investigated: it may mean reviewers are not really reviewing.

## Explanation and correction
- A person affected by a decision can ask for the reasons, and receives them in plain language within [number] working days.
- A person can ask for a decision to be reconsidered by someone who was not involved in the original decision.
- Corrections are recorded, and their causes are fed back to the system's owner.

## Change
A material change to a system (a new model, new data, a new use) is approved by the accountable person before it reaches production, and recorded.

## Review
The accountable persons and [role] review this policy every twelve months.`,
  },
  {
    key: 'information-security',
    title: 'Information security policy',
    summary: 'The baseline: access, authentication, devices, code and suppliers.',
    controls: ['ISO 27001 A.5.1', 'ISO 27001 A.8.5', 'ISO 27001 A.8.32', 'POPIA s19'],
    body: `# Information security policy

## Purpose
POPIA section 19 requires [Organisation] to secure the personal information it holds with reasonable technical and organisational measures. This policy sets those measures.

## Access
- People get access to the systems and information their work needs, and no more.
- Access is removed on the day someone leaves, and reviewed for everyone at least every [six] months.
- Administrator rights are held by as few people as possible, and never used for everyday work.

## Sign-in
- Every account uses a second factor (an authenticator app or a security key) wherever the system supports it.
- Passwords are unique per system and kept in [password manager].

## Devices
- Work devices have disk encryption, automatic updates and a screen lock on.
- A lost or stolen device is reported to [role] immediately.

## Software and code
- Changes to production systems go through review by someone other than their author.
- Dependencies are kept up to date, and known critical vulnerabilities are fixed within [14] days.
- Credentials never go into code repositories. A leaked credential is rotated immediately.

## Suppliers
Suppliers who handle personal information on our behalf sign a written agreement that requires them to protect it (POPIA sections 20 and 21).

## Review
[Role] reviews this policy every twelve months.`,
  },
  {
    key: 'incident-response',
    title: 'Security incident response policy',
    summary: 'What happens when something goes wrong, including POPIA notification.',
    controls: ['POPIA s22', 'ISO 27001 A.5.24', 'ISO 27001 A.5.26', 'ISO 42001 A.8.4', 'EU AI Act Art. 73'],
    body: `# Security incident response policy

## What counts as an incident
Anything that may have exposed, changed or lost information we hold, including a lost device, a leaked password or key, a phishing click, data sent to the wrong person, or a system acting outside its declared purpose.

## Report it
Anyone who notices an incident tells [role] at [contact] straight away. Do not try to investigate on your own first.

## Respond
- [Role] leads the response. The first steps are to stop it getting worse: revoke or rotate credentials, disable affected accounts, isolate affected systems.
- Everything done is written down with the time it was done.

## Notify
- If personal information was, or may have been, accessed or acquired by an unauthorised person, we notify the Information Regulator and the people affected as soon as reasonably possible, as POPIA section 22 requires.
- Where we process information for a client, we tell that client without undue delay so they can meet their own obligations.

## Learn
Within two weeks of an incident, [role] writes a short account of what happened, why, and what we changed so it cannot happen the same way again.

## Review
[Role] reviews this policy every twelve months, and after every significant incident.`,
  },
];

export const TEMPLATE_BY_KEY = Object.fromEntries(POLICY_TEMPLATES.map((t) => [t.key, t]));
