/**
 * Common controls: the things an organisation actually does, once, that many
 * frameworks ask about in their own words.
 *
 * Each common control lists what on the platform is evidence for it:
 *   - an automated check from a connected system (GitHub, Microsoft 365, AI providers),
 *   - a policy adopted from AIC's templates (counts once published and accepted by everyone),
 *   - an AIC standard requirement, through the evidence AIC has accepted for it,
 *   - and, for every control, documents the organisation files against the control itself.
 *
 * Framework requirements (lib/frameworks) point at these keys; a test checks
 * that every key they name exists here.
 */

export type CommonSource =
  | { kind: 'check'; key: string }
  | { kind: 'policy'; key: string }
  | { kind: 'requirement'; code: string };

export type CommonArea = 'governance' | 'identity' | 'development' | 'operations' | 'ai' | 'privacy';

export type CommonControl = {
  key: string;
  area: CommonArea;
  title: string;
  /** What good evidence looks like, for someone filing a document. */
  evidence: string;
  sources: CommonSource[];
};

const check = (key: string): CommonSource => ({ kind: 'check', key });
const policy = (key: string): CommonSource => ({ kind: 'policy', key });
const req = (code: string): CommonSource => ({ kind: 'requirement', code });

export const AREA_LABEL: Record<CommonArea, string> = {
  governance: 'Governance',
  identity: 'Identity and access',
  development: 'Software development',
  operations: 'Operations',
  ai: 'AI systems',
  privacy: 'Privacy',
};

export const COMMON_CONTROLS: CommonControl[] = [
  { key: 'gov.infosec_policy', area: 'governance', title: 'Information security policy', evidence: 'The approved policy, with its date and approver.', sources: [policy('information-security')] },
  { key: 'gov.ai_policy', area: 'governance', title: 'AI use policy', evidence: 'The policy on how the organisation uses AI, and its disclosure policy.', sources: [policy('ai-acceptable-use'), req('TR-1')] },
  { key: 'gov.policy_acceptance', area: 'governance', title: 'Staff accept the policies', evidence: 'A record of who accepted which version, and when.', sources: [policy('information-security'), policy('ai-acceptable-use'), policy('human-oversight'), policy('incident-response')] },
  { key: 'gov.accountability', area: 'governance', title: 'Named accountable people', evidence: 'Who is accountable for security, privacy and each AI system, in writing, with their signed acknowledgement.', sources: [req('HU-1'), req('HU-2'), req('CO-9')] },
  { key: 'gov.risk_assessment', area: 'governance', title: 'Risk assessment', evidence: 'The latest risk register or assessment, with treatments and owners.', sources: [] },

  { key: 'iam.mfa', area: 'identity', title: 'Multi-factor sign-in', evidence: 'A setting or report showing a second factor is required for everyone.', sources: [check('m365.mfa_enforced'), check('m365.mfa_registered'), check('github.org_2fa_required')] },
  { key: 'iam.privileged', area: 'identity', title: 'Administrator access kept small', evidence: 'The list of administrators and why each needs it.', sources: [check('m365.global_admins')] },
  { key: 'iam.leavers', area: 'identity', title: 'Access removed when people leave', evidence: 'The leaver checklist and a recent example of it being followed.', sources: [check('m365.stale_accounts')] },
  { key: 'iam.access_review', area: 'identity', title: 'Access reviewed regularly', evidence: 'The latest access review: who reviewed which system, and what changed.', sources: [] },

  { key: 'dev.change_review', area: 'development', title: 'Changes reviewed before release', evidence: 'Branch protection settings and an example of a reviewed change.', sources: [check('github.branch_protected'), check('github.review_required'), check('github.merged_with_review')] },
  { key: 'dev.ai_code_review', area: 'development', title: 'AI-written code reviewed by a person', evidence: 'How AI-assisted changes are marked and reviewed.', sources: [check('github.ai_changes_reviewed')] },
  { key: 'dev.vulnerabilities', area: 'development', title: 'Vulnerabilities found and fixed', evidence: 'Scanning results and the time taken to fix what they found.', sources: [check('github.no_critical_vulnerabilities')] },
  { key: 'dev.secrets', area: 'development', title: 'Secrets kept out of code', evidence: 'Secret scanning settings and how a leaked key is rotated.', sources: [check('github.no_exposed_secrets')] },

  { key: 'ops.incident_response', area: 'operations', title: 'Incident response', evidence: 'The incident plan and the record of the latest incident or exercise.', sources: [policy('incident-response')] },
  { key: 'ops.breach_notification', area: 'operations', title: 'Breach notification', evidence: 'Who notifies the regulator and affected people, within what deadline, and a template.', sources: [policy('incident-response')] },
  { key: 'ops.logging_monitoring', area: 'operations', title: 'Logging and monitoring', evidence: 'What is logged, where, for how long, and who looks at it.', sources: [] },
  { key: 'ops.backup', area: 'operations', title: 'Backups and recovery', evidence: 'The backup schedule and the result of the latest restore test.', sources: [] },
  { key: 'ops.encryption', area: 'operations', title: 'Encryption', evidence: 'How data is encrypted in storage and in transit.', sources: [] },
  { key: 'ops.supplier_mgmt', area: 'operations', title: 'Supplier risk', evidence: 'The list of suppliers who handle data, with the review of each.', sources: [] },
  { key: 'ops.awareness_training', area: 'operations', title: 'Security and AI awareness training', evidence: 'Training records: who completed what, and when.', sources: [] },
  { key: 'ops.asset_inventory', area: 'operations', title: 'Asset inventory', evidence: 'The list of systems and data the organisation holds, with owners.', sources: [] },
  { key: 'ops.endpoint', area: 'operations', title: 'Device security', evidence: 'Device management settings: encryption, updates, malware protection.', sources: [] },

  { key: 'ai.inventory', area: 'ai', title: 'AI system inventory', evidence: 'Every AI system in use, what it decides, and who owns it.', sources: [check('ai.models_declared'), check('github.ai_usage_declared'), req('HU-3'), req('HU-10')] },
  { key: 'ai.monitoring', area: 'ai', title: 'AI systems monitored in use', evidence: 'How the systems are watched in production and what triggers a review.', sources: [check('ai.usage_fresh'), req('HU-8')] },
  { key: 'ai.human_oversight', area: 'ai', title: 'Human oversight of AI decisions', evidence: 'The override process, and proof it works in production.', sources: [policy('human-oversight'), req('HU-4'), req('HU-5'), req('HU-6')] },
  { key: 'ai.decision_logging', area: 'ai', title: 'AI decisions and overrides recorded', evidence: 'The decision log, with overrides and their reasons.', sources: [req('HU-7'), req('CO-5'), req('EX-3')] },
  { key: 'ai.impact_bias', area: 'ai', title: 'Impact and bias assessment', evidence: 'The latest impact assessment and bias test results.', sources: [req('EM-6'), req('EM-7'), req('EM-8')] },
  { key: 'ai.transparency', area: 'ai', title: 'People told when AI is used', evidence: 'Where and how people are told, before the decision affects them.', sources: [req('TR-2'), req('TR-7')] },
  { key: 'ai.explanation', area: 'ai', title: 'Decisions explained', evidence: 'How a person gets an explanation of a decision about them.', sources: [req('EX-1'), req('EX-2'), req('EX-4')] },
  { key: 'ai.documentation', area: 'ai', title: 'AI system documentation', evidence: 'Model cards: purpose, data, limits and inputs of each system.', sources: [req('EX-6'), req('EX-7')] },
  { key: 'ai.contestability', area: 'ai', title: 'Decisions can be challenged', evidence: 'The appeal route and how upheld challenges change the outcome.', sources: [req('CO-1'), req('CO-2'), req('CO-8')] },

  { key: 'priv.lawful_basis', area: 'privacy', title: 'Lawful basis for processing', evidence: 'The record of processing, with the purpose and basis of each.', sources: [] },
  { key: 'priv.subject_rights', area: 'privacy', title: 'Data subject requests', evidence: 'The process for access, correction and deletion requests, and the log of them.', sources: [] },
  { key: 'priv.notice', area: 'privacy', title: 'Privacy notice', evidence: 'The published privacy notice.', sources: [] },
  { key: 'priv.retention', area: 'privacy', title: 'Data kept no longer than needed', evidence: 'The retention schedule and how deletion happens.', sources: [] },
  { key: 'priv.dpo', area: 'privacy', title: 'Information Officer or DPO', evidence: 'Who it is, and their registration with the regulator where required.', sources: [] },
];

export const COMMON_BY_KEY: Record<string, CommonControl> = Object.fromEntries(COMMON_CONTROLS.map((c) => [c.key, c]));

/** Documents filed against a common control carry this slot type. */
export const CONTROL_SLOT_PREFIX = 'CONTROL:';
export const controlSlot = (key: string) => `${CONTROL_SLOT_PREFIX}${key}`;
export const controlFromSlot = (slot: string | null | undefined): string | null =>
  slot && slot.startsWith(CONTROL_SLOT_PREFIX) && COMMON_BY_KEY[slot.slice(CONTROL_SLOT_PREFIX.length)] ? slot.slice(CONTROL_SLOT_PREFIX.length) : null;
