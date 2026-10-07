// Documentation for the AIC platform, at /docs inside the platform.
//
// Kept here rather than on the public website (October 2026) so that how the
// platform works, including the API, is available to signed-in organisations
// and not published to everyone. The middleware already requires a session for
// every path that is not explicitly public, and /docs is not.
//
// Every statement here describes behaviour that exists in the platform
// as of October 2026, checked against this repository:
// the set-up guide (lib/onboarding.ts), connected systems (lib/integrations,
// lib/connectors), the decision log API (app/api/decisions), the insurer
// extract (app/api/insurance/risk-score) and agents (lib/agents). When the
// platform changes, the page that describes it changes with it.

export type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "code"; label: string; code: string }
  | { kind: "fields"; items: { name: string; text: string }[] }
  | { kind: "note"; text: string };

export interface DocPage {
  slug: string;
  group: "Start" | "Using the platform" | "Developers" | "Certification";
  title: string;
  summary: string;
  body: DocBlock[];
}

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    group: "Start",
    title: "Getting started",
    summary: "Register your organisation and work through the set-up guide, which points at each control as you go.",
    body: [
      { kind: "p", text: "The person who registers an organisation becomes its first administrator and can invite colleagues from Team, in the menu under their name. Everyone in your organisation signs in with a password and a second factor from an authenticator app." },
      { kind: "p", text: "Once you are in, a set-up guide opens on your dashboard. Each step takes you to the right page and highlights the control to use. You can skip a step, leave the guide and come back, or restart the tour from the menu under your name." },
      { kind: "h", text: "The steps, and roughly how long each takes" },
      { kind: "steps", items: [
        { title: "Name your accountable person", text: "The individual answerable for your AI decisions. About 2 minutes." },
        { title: "Declare your first AI system", text: "What it is for, and who is accountable for it. About 3 minutes." },
        { title: "Choose your frameworks", text: "The laws and standards you want to track evidence against. About 2 minutes." },
        { title: "Connect a system AIC can read", text: "Read-only access to one of your systems, such as GitHub or Microsoft 365. About 5 minutes." },
        { title: "Log your first decision", text: "Create an API key and record a decision from one of your systems. About 10 minutes; administrators only." },
        { title: "Publish a policy", text: "From a template or your own. About 10 minutes." },
        { title: "File your first evidence", text: "Against a requirement for your Division. About 5 minutes." },
        { title: "Start your supplier register", text: "Who holds your data or runs part of your service. About 5 minutes." },
        { title: "Record your first risks", text: "What could go wrong, how bad it would be, and who owns it. About 5 minutes." },
        { title: "Invite a colleague", text: "About a minute; administrators only." },
        { title: "Take AIC Aware", text: "The free self-assessment, which earns your organisation a badge. About 10 minutes." },
      ] },
      { kind: "note", text: "Nothing you do in the platform raises or lowers your chance of being certified. The platform is where you keep your record; certification is an independent audit of it." },
    ],
  },
  {
    slug: "connecting-systems",
    group: "Using the platform",
    title: "Connecting your systems",
    summary: "How AIC reads your systems, what it can and cannot do with that access, and how to remove it.",
    body: [
      { kind: "p", text: "Connected systems are how your record stays current without anyone rebuilding it. AIC reads each connected system every night, runs its automated checks, and records any change of result in your continuity record. Each check says why it matters and how to fix it." },
      { kind: "h", text: "What AIC asks for" },
      { kind: "list", items: [
        "Read-only access, always. AIC never asks for permission to change anything in your systems.",
        "You can remove AIC's access from your side at any time; the next nightly read then fails and the connection is marked disconnected.",
        "A connector AIC has not yet seen working against a real client account is marked new in the platform until it has.",
      ] },
      { kind: "h", text: "How each kind connects" },
      { kind: "fields", items: [
        { name: "Microsoft 365", text: "A global administrator approves AIC's app on Microsoft's consent screen, then signs in with an account from the same organisation. AIC takes your tenant from that sign-in, not from the address it returns to, and a tenant can be connected to one AIC organisation only. Azure and Intune use the same connection." },
        { name: "GitHub", text: "Installed as a read-only GitHub App on the organisation or repositories you choose." },
        { name: "OpenAI and Anthropic", text: "Either run AIC's exporter yourself, so AIC never holds a key, or paste a read-only key, which AIC stores encrypted." },
        { name: "Everything else", text: "Each connector asks for the credential its provider offers, such as a service account or a read-only token. AIC stores it encrypted and shows only its last characters." },
      ] },
      { kind: "p", text: "The systems AIC can read today include AWS, Google Cloud, Azure, Cloudflare, Datadog, GitLab, Bitbucket, Snyk, Google Workspace, Okta, 1Password, Intune, Jamf, Kandji, CrowdStrike, BambooHR, HiBob, Personio, Deel, Rippling, Jira, Linear, Zendesk, Slack and Salesforce." },
    ],
  },
  {
    slug: "frameworks-and-evidence",
    group: "Using the platform",
    title: "Frameworks and evidence",
    summary: "Track the laws and standards that apply to you, with evidence collected once and counted everywhere it applies.",
    body: [
      { kind: "p", text: "Choose the frameworks you are held to under Compliance tracking, Frameworks. The platform tracks twenty, including POPIA, the EU AI Act, GDPR, ISO/IEC 42001, ISO/IEC 27001, NIST AI RMF, SOC 2 and Cyber Essentials, and you can add your own." },
      { kind: "p", text: "Evidence is collected once, against a set of common controls, and every framework reads from it. One check that everyone has a second factor counts towards each framework that asks for it, without being filed three times." },
      { kind: "note", text: "A mapping says this kind of evidence usually supports this requirement. It is not an auditor's conclusion, and a requirement AIC does not cover is shown as not mapped rather than dropped." },
      { kind: "p", text: "Policies, the evidence vault, and policy against practice sit alongside: the last of these shows where what your policies promise and what your connected systems show disagree." },
    ],
  },
  {
    slug: "decision-log-api",
    group: "Developers",
    title: "Decision log API",
    summary: "Record what your AI decides from the systems that decide it, and hold a decision for a named person to review.",
    body: [
      { kind: "p", text: "Any system that makes a consequential decision can record it in your decision log. Create a key under API and access keys in the menu under your name (administrators only). Keys begin with aic_live_ and are sent as a bearer token." },
      { kind: "code", label: "Record a decision", code: `curl -X POST https://app.aiccertified.cloud/api/decisions \\
  -H "Authorization: Bearer aic_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "system_name": "Credit scoring v3",
    "input_params": { "application_id": "A-1042", "score": 612 },
    "outcome": "declined",
    "explanation": "Debt-to-income above policy limit",
    "external_ref": "A-1042"
  }'` },
      { kind: "fields", items: [
        { name: "system_name", text: "Required. The system as it is declared on your AI estate." },
        { name: "input_params", text: "Required. What the decision was made on." },
        { name: "outcome", text: "Required. What was decided." },
        { name: "explanation", text: "The reason given, in plain language." },
        { name: "external_ref", text: "Your own reference, up to 255 characters." },
        { name: "require_review", text: "true holds the decision for a named person to approve or override before you act on it." },
        { name: "review_within_hours", text: "How long a held decision may wait: 72 hours by default, up to 30 days. After that it expires." },
        { name: "callback_url", text: "Only with require_review. AIC tells this address what the person decided." },
      ] },
      { kind: "p", text: "A recorded decision returns 201. A held decision returns 202 with its id and a poll address, GET /api/decisions/<id>; do not act on the outcome until its review status is approved or overridden." },
      { kind: "p", text: "Callbacks are signed. Each carries X-AIC-Timestamp and X-AIC-Signature, which is sha256= followed by an HMAC-SHA256 of \"<timestamp>.<body>\" using your organisation's callback secret, shown to your administrators. AIC makes one attempt with a five-second limit, so polling remains the fallback." },
      { kind: "note", text: "A key cannot record that a person overrode a decision; that request is refused with 403. An override is evidence that a named person was answerable for the outcome, and a key identifies a system, not a person. Record the decision with the key, and have the person who overrode it record the override while signed in." },
    ],
  },
  {
    slug: "sharing-with-your-insurer",
    group: "Developers",
    title: "Sharing with your insurer",
    summary: "Let an insurer read observations from your record with a key you issue and can withdraw.",
    body: [
      { kind: "p", text: "If your insurer asks, issue them a key under API and access keys. With it they read an extract of your record from AIC directly. The extract is built from the same source as your own overview, so they never see a different picture from the one you manage." },
      { kind: "p", text: "It contains observations only, such as the number of accountable people on record, open findings, the human override rate with its sample size, and gaps by severity. It carries no rating, grade or recommendation: pricing and acceptance are the insurer's decisions." },
      { kind: "note", text: "Withdraw the key at any time, and the insurer's access ends with it." },
    ],
  },
  {
    slug: "agents",
    group: "Using the platform",
    title: "Agents",
    summary: "Optionally run your own AI agents from the platform, with their reach and spend fixed in advance.",
    body: [
      { kind: "p", text: "An agent can only use the tools you give it: calls to the web addresses you allow, or one SharePoint site, library or folder. Every step is checked against that scope and kept in a record that shows if anything was changed afterwards." },
      { kind: "p", text: "Each agent is declared on your AI estate like any other system, with a named person accountable for it. For SharePoint, AIC uses a separate app with access only to what you approve, and a Microsoft administrator signs in to prove the tenant is yours." },
      { kind: "note", text: "Agents are a convenience. Running them through AIC has no bearing on certification, and choosing not to changes nothing." },
    ],
  },
  {
    slug: "aic-aware",
    group: "Certification",
    title: "AIC Aware",
    summary: "The free self-assessment, and the badge an organisation can hold once it has taken it.",
    body: [
      { kind: "p", text: "AIC Aware asks twenty questions across the same areas AIC audits, takes about ten minutes, and ends with a report you can download. Anyone can take it on aiccertified.cloud without an account; take it here, under AIC Certification, AIC Aware, to earn your organisation's badge." },
      { kind: "p", text: "A badge is issued to an organisation that takes AIC Aware from its platform account, and can be listed in the public AIC Aware directory if the organisation chooses." },
      { kind: "note", text: "AIC Aware is self-declared. Nobody at AIC verifies the answers, it never appears on the certified register, and the badge rules set out where it may and may not be used." },
    ],
  },
  {
    slug: "certification",
    group: "Certification",
    title: "From the platform to a certificate",
    summary: "How an assessment runs, and why it is kept apart from everything else AIC offers.",
    body: [
      { kind: "p", text: "Certification is an independent audit against the AIC standard's 44 published requirements, scoped to your Division: how much human judgement sits between your AI and its decisions." },
      { kind: "steps", items: [
        { title: "Apply", text: "Your organisation applies from the platform, and an AIC assessor is assigned to lead your file, with another to review." },
        { title: "Evidence review", text: "The assessor reviews the evidence you file against each requirement, accepting it or sending it back with a reason." },
        { title: "Findings", text: "Anything that falls short is raised as a finding, and you answer it with a corrective action, all on the record." },
        { title: "Decision", text: "The certification decision is a separate step from the assessment, taken by someone AIC has authorised to make it." },
        { title: "Certificate", text: "A certified organisation appears on the public register, and anyone can check its certificate's status, scope and expiry on the verify page." },
      ] },
      { kind: "note", text: "AIC never designs governance for an organisation it certifies, and using the platform's tools does not count for or against you. Evidence is treated the same wherever it came from." },
    ],
  },
];

export const DOC_GROUPS: DocPage["group"][] = ["Start", "Using the platform", "Developers", "Certification"];

export function docBySlug(slug: string): DocPage | undefined {
  return DOCS.find((d) => d.slug === slug);
}
