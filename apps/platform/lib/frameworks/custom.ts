/**
 * Custom frameworks: validation, parsing a pasted list, and a first guess at
 * which common controls each requirement maps to.
 *
 * The guess is keyword matching and nothing more. It is offered as a starting
 * point the person checks and corrects; nothing is mapped without them saving it.
 */
import { COMMON_BY_KEY } from '../common-controls';

export const CUSTOM_LIMITS = { name: 120, description: 1000, requirements: 400, ref: 40, title: 600, controlsPer: 6 };

const HINTS: [RegExp, string][] = [
  [/\bmfa\b|multi-?factor|two-?factor|\b2fa\b|second factor/i, 'iam.mfa'],
  [/privileged|admin(istrator)? (access|account|rights)|least privilege|super ?user/i, 'iam.privileged'],
  [/leaver|terminat|offboard|deprovision|dormant|inactive account|unused account/i, 'iam.leavers'],
  [/access review|review (of )?(user )?access|recertif|entitlement/i, 'iam.access_review'],
  [/change (management|control|request)|code review|peer review|pull request|branch protection|release approval/i, 'dev.change_review'],
  [/(ai|copilot|generated)[- ]?(written|generated|assisted)? code/i, 'dev.ai_code_review'],
  [/vulnerab|patch|penetration|pen ?test|scan(ning)?\b|cve\b/i, 'dev.vulnerabilities'],
  [/secret|credential|api key|password storage|key management/i, 'dev.secrets'],
  [/incident (response|management|handling|plan)|security incident/i, 'ops.incident_response'],
  [/breach notif|notify (the )?(regulator|authorit|customer|data subject)|notification of (a )?(breach|incident)|72 hours/i, 'ops.breach_notification'],
  [/\blog(s|ging)?\b|monitor(ing)? (of )?(system|activity|event)|siem|audit trail/i, 'ops.logging_monitoring'],
  [/backup|back-up|disaster recovery|business continuity|\brto\b|\brpo\b|restore/i, 'ops.backup'],
  [/encrypt|cryptograph|\btls\b|at rest|in transit/i, 'ops.encryption'],
  [/supplier|vendor|third[- ]part|subprocessor|sub-processor|outsourc|service provider/i, 'ops.supplier_mgmt'],
  [/training|awareness|education/i, 'ops.awareness_training'],
  [/asset (inventory|register)|inventory of (assets|systems)|configuration management database|\bcmdb\b/i, 'ops.asset_inventory'],
  [/endpoint|device|laptop|malware|anti-?virus|hardening|mobile device/i, 'ops.endpoint'],
  [/security policy|information security polic/i, 'gov.infosec_policy'],
  [/ai (use |usage |acceptable use |governance )?polic/i, 'gov.ai_policy'],
  [/acknowledg|accept(ance)? of (the )?polic|sign(ed)? (the )?polic/i, 'gov.policy_acceptance'],
  [/accountab|responsib(le|ility) (person|owner)|roles and responsibilit|ciso|security officer|oversight by (the )?board/i, 'gov.accountability'],
  [/risk (assessment|register|management|treatment)/i, 'gov.risk_assessment'],
  [/(ai|model|algorithm)s? (inventory|register)|inventory of (ai|models)/i, 'ai.inventory'],
  [/model (monitoring|performance)|drift|monitor(ing)? (the )?(ai|model)/i, 'ai.monitoring'],
  [/human (oversight|review|in the loop|intervention)|override/i, 'ai.human_oversight'],
  [/decision (log|record)|record(ing)? (of )?decisions/i, 'ai.decision_logging'],
  [/bias|fairness|discriminat|impact assessment|disparate/i, 'ai.impact_bias'],
  [/disclos(e|ure) (of |that )?(ai|automated)|transparen/i, 'ai.transparency'],
  [/explain|explanation|reasons? for (the )?decision/i, 'ai.explanation'],
  [/model card|technical documentation|system documentation/i, 'ai.documentation'],
  [/appeal|contest|challenge (a |the )?decision|redress|correction/i, 'ai.contestability'],
  [/lawful basis|legal basis|purpose (limitation|specification)|consent/i, 'priv.lawful_basis'],
  [/data subject|subject access|right (of|to) (access|erasure|deletion|rectification)|opt[- ]out|\bdsar\b/i, 'priv.subject_rights'],
  [/privacy (notice|policy|statement)/i, 'priv.notice'],
  [/retention|retain|minimi[sz]|deletion schedule|disposal/i, 'priv.retention'],
  [/data protection officer|\bdpo\b|information officer|privacy officer/i, 'priv.dpo'],
];

/** Common controls a requirement's wording suggests, best first, at most three. */
export function suggestControls(text: string): string[] {
  const out: string[] = [];
  for (const [re, key] of HINTS) if (re.test(text) && !out.includes(key)) out.push(key);
  return out.slice(0, 3);
}

/**
 * One requirement per line. A reference can lead the line, separated by a
 * tab, a comma, " - " or ": "; otherwise the lines are numbered.
 */
export function parseRequirementList(text: string): { id: string; title: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, CUSTOM_LIMITS.requirements).map((line, i) => {
    const m = line.match(/^([A-Za-z0-9][A-Za-z0-9.()\-_/]{0,38})\s*(?:\t|,|\s-\s|:\s)\s*(.+)$/);
    if (m && /\d/.test(m[1])) return { id: m[1], title: m[2].replace(/^"|"$/g, '').trim().slice(0, CUSTOM_LIMITS.title) };
    return { id: String(i + 1), title: line.replace(/^"|"$/g, '').slice(0, CUSTOM_LIMITS.title) };
  });
}

export type CustomInput = { name: string; description: string | null; requirements: { id: string; title: string; controls: string[] }[] };

/** Validates a custom framework from a request body. Returns an error message, or the clean value. */
export function validateCustom(b: unknown): { error: string } | { value: CustomInput } {
  const o = (b ?? {}) as { name?: unknown; description?: unknown; requirements?: unknown };
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return { error: 'Give the framework a name.' };
  if (name.length > CUSTOM_LIMITS.name) return { error: `The name can be at most ${CUSTOM_LIMITS.name} characters.` };
  const description = typeof o.description === 'string' && o.description.trim() ? o.description.trim().slice(0, CUSTOM_LIMITS.description) : null;
  if (!Array.isArray(o.requirements) || o.requirements.length === 0) return { error: 'Add at least one requirement.' };
  if (o.requirements.length > CUSTOM_LIMITS.requirements) return { error: `A framework can have at most ${CUSTOM_LIMITS.requirements} requirements.` };
  const seen = new Set<string>();
  const requirements: CustomInput['requirements'] = [];
  for (const [i, r] of (o.requirements as unknown[]).entries()) {
    const x = (r ?? {}) as { id?: unknown; title?: unknown; controls?: unknown };
    const id = (typeof x.id === 'string' && x.id.trim() ? x.id.trim() : String(i + 1)).slice(0, CUSTOM_LIMITS.ref);
    const title = typeof x.title === 'string' ? x.title.trim() : '';
    if (!title) return { error: `Requirement ${id} has no wording.` };
    if (title.length > CUSTOM_LIMITS.title) return { error: `Requirement ${id} is longer than ${CUSTOM_LIMITS.title} characters.` };
    if (seen.has(id)) return { error: `Two requirements share the reference ${id}.` };
    seen.add(id);
    const controls = Array.isArray(x.controls) ? [...new Set(x.controls.filter((k): k is string => typeof k === 'string'))] : [];
    const unknown = controls.find((k) => !COMMON_BY_KEY[k]);
    if (unknown) return { error: `Requirement ${id} names a control AIC does not know: ${unknown}.` };
    if (controls.length > CUSTOM_LIMITS.controlsPer) return { error: `Requirement ${id} maps to more than ${CUSTOM_LIMITS.controlsPer} controls.` };
    requirements.push({ id, title, controls });
  }
  return { value: { name, description, requirements } };
}
