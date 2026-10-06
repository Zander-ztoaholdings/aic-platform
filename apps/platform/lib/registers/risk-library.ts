/**
 * AIC's risk library: risks most organisations that use AI to make decisions
 * about people should consider, plus the core security risks every register
 * needs. A starting point, not a verdict: each template's likelihood and
 * impact are suggestions for the organisation to change.
 *
 * `controls` are common control keys (lib/common-controls): the controls that
 * reduce the risk, whose live status feeds the risk's current score.
 * `signals` are the AIC observations that evidence the risk
 * (lib/registers/risk-signals), and `raisedBy` the common controls whose
 * failing automated checks should raise it as a suggestion.
 */
import type { SignalKind } from './risk-signals';

export type RiskTemplate = {
  key: string;
  title: string;
  description: string;
  category: 'security' | 'privacy' | 'ai' | 'operational' | 'compliance' | 'supplier';
  likelihood: number;
  impact: number;
  treatment: 'mitigate' | 'accept' | 'transfer' | 'avoid';
  treatmentPlan: string;
  controls: string[];
  signals: SignalKind[];
  raisedBy?: string[];
};

export const RISK_LIBRARY: RiskTemplate[] = [
  // ── AI decisions about people ─────────────────────────────────────────────
  {
    key: 'ai_unfair_outcomes', category: 'ai', likelihood: 3, impact: 5, treatment: 'mitigate',
    title: 'A model makes unfair decisions about a protected group',
    description: 'An automated system approves, declines or ranks people from one group differently from others, through biased training data or a proxy such as postcode. People are harmed, and the organisation faces Equality Act and POPIA complaints.',
    treatmentPlan: 'Test outcomes by group before release and at least quarterly; send borderline cases to a person; record and act on the results.',
    controls: ['ai.impact_bias', 'ai.human_oversight', 'ai.decision_logging'], signals: ['quiet_system'],
  },
  {
    key: 'no_human_override', category: 'compliance', likelihood: 3, impact: 5, treatment: 'mitigate',
    title: 'An automated decision has no person able to override it (POPIA s71)',
    description: 'A decision with legal or similarly significant effect is made solely by a machine, and nobody reviews, overrides or explains it. POPIA section 71 gives people the right not to be subject to such decisions without safeguards.',
    treatmentPlan: 'Name the people who can override each system, give them a way to do it in the workflow, and check that overrides actually happen.',
    controls: ['ai.human_oversight', 'ai.contestability', 'ai.decision_logging'], signals: ['quiet_system'],
  },
  {
    key: 'decision_not_explained', category: 'compliance', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'People cannot get an explanation of a decision about them',
    description: 'Someone declined or flagged by a system asks why, and the organisation cannot say which information was used or how it led to the outcome.',
    treatmentPlan: 'Record the main reasons with every decision and keep a short template answer for each outcome.',
    controls: ['ai.explanation', 'ai.decision_logging', 'ai.documentation'], signals: [],
  },
  {
    key: 'ai_not_disclosed', category: 'compliance', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'People are not told that AI is used in decisions about them',
    description: 'Customers or staff are not informed that an automated system takes part in a decision affecting them, so they cannot ask for a person or challenge it.',
    treatmentPlan: 'Add a plain notice where each decision is communicated, and in the privacy notice.',
    controls: ['ai.transparency', 'priv.notice'], signals: [],
  },
  {
    key: 'no_challenge_route', category: 'compliance', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Decisions cannot be challenged, or a challenge changes nothing',
    description: 'There is no clear route to contest an automated decision, or upheld challenges do not change the outcome or the system.',
    treatmentPlan: 'Publish the appeal route, give it an owner and a deadline, and feed upheld challenges back into the system.',
    controls: ['ai.contestability', 'ai.human_oversight'], signals: [],
  },
  {
    key: 'model_drift', category: 'ai', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: "A model's performance drifts and nobody notices",
    description: 'The people or data a system sees change over time, its accuracy or fairness worsens, and nothing in the monitoring raises it until harm is done.',
    treatmentPlan: 'Monitor outcomes and inputs in production, with a named person who reviews them and a threshold that triggers a review.',
    controls: ['ai.monitoring', 'ai.impact_bias'], signals: ['check'], raisedBy: ['ai.monitoring'],
  },
  {
    key: 'shadow_ai', category: 'ai', likelihood: 4, impact: 3, treatment: 'mitigate',
    title: 'AI systems are in use that nobody declared',
    description: 'Teams use AI tools or models that are not in the inventory, so nobody owns them, checks what they decide, or knows what data they receive.',
    treatmentPlan: 'Declare every system that is found, give it an owner, and make the AI use policy say how new tools are approved.',
    controls: ['ai.inventory', 'gov.ai_policy'], signals: ['undeclared_ai', 'check'], raisedBy: ['ai.inventory'],
  },
  {
    key: 'prompt_injection', category: 'security', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Prompt injection makes an AI system leak data or act outside its purpose',
    description: 'Text from a customer, a document or a web page instructs a language model to reveal information or take actions it should not, such as disclosing another customer\'s details.',
    treatmentPlan: 'Limit what each assistant can see and do, keep account data out of its reach, test it with injection attempts before release, and monitor what it says.',
    controls: ['ai.monitoring', 'ai.documentation', 'dev.change_review'], signals: [],
  },
  {
    key: 'pi_cross_border', category: 'privacy', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Personal information goes to an AI provider outside South Africa without safeguards (POPIA s72)',
    description: 'Prompts or records containing personal information are sent to a provider abroad without an agreement or law giving it adequate protection, as POPIA section 72 requires.',
    treatmentPlan: 'Sign the provider\'s data processing terms, switch on zero data retention where offered, and remove personal information from prompts where it is not needed.',
    controls: ['ops.supplier_mgmt', 'priv.lawful_basis'], signals: ['supplier'],
  },
  {
    key: 'ai_provider_outage', category: 'supplier', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'An AI provider has a long outage',
    description: 'The model provider a system depends on is unavailable for hours or days, and the decisions or service it supports stop.',
    treatmentPlan: 'Decide what each system does without the provider: a fallback model, a manual process, or a holding message.',
    controls: ['ops.supplier_mgmt', 'ops.incident_response'], signals: [],
  },
  {
    key: 'model_deprecation', category: 'operational', likelihood: 4, impact: 3, treatment: 'mitigate',
    title: 'A provider retires a model a system depends on',
    description: 'A provider deprecates or retires a model in use, and the system either stops working or moves to a replacement that behaves differently without being tested.',
    treatmentPlan: 'Track retirement dates, test the replacement on real requests well before the date, and re-run bias and accuracy checks after the switch.',
    controls: ['ai.documentation', 'ai.monitoring'], signals: ['model_retiring'],
  },
  {
    key: 'ai_spend_overrun', category: 'operational', likelihood: 3, impact: 2, treatment: 'mitigate',
    title: 'AI spend runs over budget',
    description: 'Usage of paid AI models grows faster than planned, through new uses, longer prompts or a runaway process, and the monthly bill passes the budget.',
    treatmentPlan: 'Set a monthly budget, watch the trend weekly, and move routine work to cheaper models after testing.',
    controls: ['ai.monitoring'], signals: ['spend'],
  },
  {
    key: 'inadequate_logging', category: 'compliance', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Decisions and system activity are not logged well enough to reconstruct what happened',
    description: 'When a decision is challenged or an incident happens, there is no reliable record of what the system decided, on what information, and who changed what.',
    treatmentPlan: 'Log every automated decision with its inputs, outcome and any override, and keep administrator activity logs for at least a year.',
    controls: ['ai.decision_logging', 'ops.logging_monitoring'], signals: ['check'], raisedBy: ['ops.logging_monitoring'],
  },

  // ── Identity and access ───────────────────────────────────────────────────
  {
    key: 'leaver_access', category: 'security', likelihood: 4, impact: 4, treatment: 'mitigate',
    title: 'People who have left keep access to company systems',
    description: 'Accounts of former staff or contractors stay enabled after they leave, and can be used by them or by anyone who takes over the account.',
    treatmentPlan: 'HR tells IT on the leaving date, accounts are disabled the same day, and the access review catches anything missed.',
    controls: ['iam.leavers', 'iam.access_review'], signals: ['leavers', 'check'], raisedBy: ['iam.leavers'],
  },
  {
    key: 'no_mfa', category: 'security', likelihood: 4, impact: 4, treatment: 'mitigate',
    title: 'Accounts, including administrators, can sign in without a second factor',
    description: 'A stolen or guessed password is enough to get into email, code or cloud accounts, and an administrator account opens everything.',
    treatmentPlan: 'Require a second factor for everyone, starting with administrators, and block sign-ins that do not use one.',
    controls: ['iam.mfa', 'iam.privileged'], signals: ['check'], raisedBy: ['iam.mfa'],
  },
  {
    key: 'excess_privilege', category: 'security', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Too many people hold administrator access',
    description: 'More people than necessary can change settings, read all data or remove logs, so one compromised or careless account does wide damage.',
    treatmentPlan: 'Keep administrators to a named few, each with a reason, and review the list every quarter.',
    controls: ['iam.privileged', 'iam.access_review'], signals: ['check'], raisedBy: ['iam.privileged'],
  },
  {
    key: 'access_not_reviewed', category: 'security', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'Access is not reviewed, so people keep rights they no longer need',
    description: 'Nobody checks who has access to what, so rights build up as people change roles and are never removed.',
    treatmentPlan: 'Review access to the main systems at least every six months and carry out the removals decided.',
    controls: ['iam.access_review', 'iam.leavers'], signals: ['access_review'],
  },
  {
    key: 'insider_misuse', category: 'security', likelihood: 2, impact: 4, treatment: 'mitigate',
    title: 'Someone inside misuses access to personal information or decisions',
    description: 'An employee or contractor looks up, exports or changes records for their own purposes, or overrides decisions improperly.',
    treatmentPlan: 'Give people only the access their role needs, log access to sensitive records and overrides, and review the logs.',
    controls: ['iam.access_review', 'ops.logging_monitoring', 'ai.decision_logging'], signals: [],
  },

  // ── Software and infrastructure ───────────────────────────────────────────
  {
    key: 'unpatched_dependencies', category: 'security', likelihood: 4, impact: 4, treatment: 'mitigate',
    title: 'Known vulnerabilities in software or dependencies stay unpatched',
    description: 'Libraries, operating systems or services with published vulnerabilities stay in use, giving attackers a known way in.',
    treatmentPlan: 'Scan code and systems automatically and fix critical findings within an agreed number of days.',
    controls: ['dev.vulnerabilities', 'ops.endpoint'], signals: ['check'], raisedBy: ['dev.vulnerabilities'],
  },
  {
    key: 'secrets_in_code', category: 'security', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Keys and passwords are exposed in code',
    description: 'API keys, including AI provider keys, or passwords are committed to a repository, where anyone with access to the code, or a leak of it, can use them.',
    treatmentPlan: 'Keep secrets in a secrets manager, turn on secret scanning, and rotate any key that was exposed.',
    controls: ['dev.secrets'], signals: ['check'], raisedBy: ['dev.secrets'],
  },
  {
    key: 'unreviewed_changes', category: 'security', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'Changes reach production without review, including AI-written code',
    description: 'Code, including changes written by AI coding assistants, is merged without a second person checking it, so mistakes or malicious changes reach live systems.',
    treatmentPlan: 'Protect main branches, require an approving review from someone other than the author, and mark AI-assisted changes.',
    controls: ['dev.change_review', 'dev.ai_code_review'], signals: ['check'], raisedBy: ['dev.change_review', 'dev.ai_code_review'],
  },
  {
    key: 'cloud_data_exposure', category: 'security', likelihood: 3, impact: 5, treatment: 'mitigate',
    title: 'Cloud storage or data is open to the internet or unencrypted',
    description: 'A storage bucket, database or file share is publicly readable or unencrypted, and personal information can be read by anyone who finds it.',
    treatmentPlan: 'Block public access at account level, encrypt storage, and check the settings automatically.',
    controls: ['ops.encryption'], signals: ['check'], raisedBy: ['ops.encryption'],
  },
  {
    key: 'lost_device', category: 'security', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'A lost or stolen laptop exposes company data',
    description: 'A device without disk encryption, updates or remote wipe is lost or stolen, and the data on it must be treated as a breach.',
    treatmentPlan: 'Manage every laptop: encryption on, updates enforced, and remote lock and wipe ready.',
    controls: ['ops.endpoint', 'ops.encryption', 'ops.asset_inventory'], signals: ['check'], raisedBy: ['ops.endpoint'],
  },
  {
    key: 'ransomware', category: 'security', likelihood: 3, impact: 5, treatment: 'mitigate',
    title: 'Ransomware stops operations and locks data',
    description: 'Malware encrypts systems and data, operations stop, and the attackers threaten to publish what they took.',
    treatmentPlan: 'Keep tested offline backups, require a second factor, keep devices patched, and rehearse the incident plan.',
    controls: ['ops.backup', 'ops.endpoint', 'iam.mfa', 'ops.incident_response'], signals: [],
  },
  {
    key: 'phishing_takeover', category: 'security', likelihood: 4, impact: 3, treatment: 'mitigate',
    title: 'Phishing leads to a taken-over mailbox',
    description: 'Someone enters their password on a fake page, and the attacker reads mail, sends fraudulent payment requests or moves to other systems.',
    treatmentPlan: 'Second factor for everyone, awareness training every year, and a simple way to report suspicious mail.',
    controls: ['iam.mfa', 'ops.awareness_training'], signals: [],
  },

  // ── Suppliers, privacy and governance ─────────────────────────────────────
  {
    key: 'supplier_breach', category: 'supplier', likelihood: 3, impact: 4, treatment: 'mitigate',
    title: 'A supplier holding our data is breached',
    description: 'A supplier that stores or processes the organisation\'s data, including an AI provider, is breached, and the organisation must notify the people affected.',
    treatmentPlan: 'Review each supplier that holds data before signing and every year, keep their security reports current, and agree breach notice terms.',
    controls: ['ops.supplier_mgmt', 'ops.breach_notification'], signals: ['supplier'],
  },
  {
    key: 'supplier_no_agreement', category: 'privacy', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'A supplier processes personal information without a written agreement (POPIA s21)',
    description: 'An operator handles personal information on the organisation\'s behalf with no written contract requiring it to keep the information secure, as POPIA section 21 requires.',
    treatmentPlan: 'Sign a data processing agreement with every supplier that handles personal information.',
    controls: ['ops.supplier_mgmt', 'priv.lawful_basis'], signals: ['supplier'],
  },
  {
    key: 'breach_not_reported', category: 'compliance', likelihood: 2, impact: 5, treatment: 'mitigate',
    title: 'A breach is not reported to the Information Regulator in time',
    description: 'A security compromise of personal information is found but not reported to the Information Regulator and the people affected as soon as reasonably possible (POPIA s22).',
    treatmentPlan: 'Name who decides and who notifies, keep a template, and rehearse it once a year.',
    controls: ['ops.breach_notification', 'ops.incident_response', 'priv.dpo'], signals: [],
  },
  {
    key: 'excessive_retention', category: 'privacy', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'Personal information is kept longer than needed',
    description: 'Records, decision logs or prompts are kept indefinitely, increasing what a breach exposes and breaching POPIA section 14.',
    treatmentPlan: 'Set a retention period for each kind of record and delete on schedule.',
    controls: ['priv.retention'], signals: [],
  },
  {
    key: 'findings_unresolved', category: 'compliance', likelihood: 3, impact: 3, treatment: 'mitigate',
    title: 'Audit findings are not fixed by their due date',
    description: 'Problems an assessor raised stay open past their due date, which delays certification and leaves the underlying weakness in place.',
    treatmentPlan: 'Give each finding an owner and a plan, and review progress every week until it is closed.',
    controls: ['gov.risk_assessment', 'gov.accountability'], signals: ['findings'],
  },
];

export const LIBRARY_BY_KEY: Record<string, RiskTemplate> = Object.fromEntries(RISK_LIBRARY.map((t) => [t.key, t]));
