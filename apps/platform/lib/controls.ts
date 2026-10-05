/**
 * Frameworks and their controls, and what evidence on the platform speaks to
 * each one: automated checks, adopted policies, and accepted evidence against
 * the AIC standard's requirements.
 *
 * A control's status here is a summary of evidence, not a conformity
 * decision. "Evidenced" means every source AIC can see is positive; only an
 * assessment says whether the control is actually met.
 *
 * Control titles are as published (ISO/IEC 27001:2022 Annex A; POPIA section
 * headings). Only controls the platform has evidence for are listed — a list
 * of 93 controls with nothing behind 80 of them would be decoration.
 */

export type Framework = 'aic' | 'iso42001' | 'euaiact' | 'iso27001' | 'popia';
export const FRAMEWORKS: { key: Framework; name: string; note: string }[] = [
  { key: 'aic', name: 'AIC standard', note: 'The requirements that apply to your Division.' },
  { key: 'iso42001', name: 'ISO/IEC 42001:2023', note: 'Annex A controls for an AI management system that the platform has evidence for. Certification to ISO/IEC 42001 is granted by an accredited certification body, not by this view.' },
  { key: 'euaiact', name: 'EU AI Act', note: 'Articles of Regulation (EU) 2024/1689 the platform has evidence for. They apply where you place AI systems on the EU market or their output is used in the EU.' },
  { key: 'iso27001', name: 'ISO/IEC 27001:2022', note: 'Annex A controls the platform has evidence for.' },
  { key: 'popia', name: 'POPIA', note: 'Sections of the Protection of Personal Information Act the platform has evidence for.' },
];

type Source = { kind: 'check'; key: string } | { kind: 'policy'; key: string } | { kind: 'requirement'; code: string };

export type ControlDef = { framework: Framework; id: string; title: string; sources: Source[] };

const check = (key: string): Source => ({ kind: 'check', key });
const policy = (key: string): Source => ({ kind: 'policy', key });
const req = (code: string): Source => ({ kind: 'requirement', code });

export const CONTROLS: ControlDef[] = [
  // ISO/IEC 42001:2023 Annex A (reference control objectives and controls)
  { framework: 'iso42001', id: 'A.2.2', title: 'AI policy', sources: [policy('ai-acceptable-use'), policy('human-oversight')] },
  { framework: 'iso42001', id: 'A.3.2', title: 'AI roles and responsibilities', sources: [req('HU-1'), req('HU-2')] },
  { framework: 'iso42001', id: 'A.3.3', title: 'Reporting of concerns', sources: [policy('incident-response')] },
  { framework: 'iso42001', id: 'A.4.4', title: 'Tooling resources', sources: [check('ai.models_declared'), check('github.ai_usage_declared')] },
  { framework: 'iso42001', id: 'A.5.4', title: 'Assessing AI system impact on individuals or groups of individuals', sources: [req('EM-6'), req('EM-7')] },
  { framework: 'iso42001', id: 'A.6.1.3', title: 'Processes for responsible AI system design and development', sources: [check('github.ai_changes_reviewed'), check('github.merged_with_review')] },
  { framework: 'iso42001', id: 'A.6.2.6', title: 'AI system operation and monitoring', sources: [check('ai.usage_fresh'), req('HU-8')] },
  { framework: 'iso42001', id: 'A.6.2.7', title: 'AI system technical documentation', sources: [req('EX-7')] },
  { framework: 'iso42001', id: 'A.6.2.8', title: 'AI system recording of event logs', sources: [req('HU-7'), req('CO-5')] },
  { framework: 'iso42001', id: 'A.8.2', title: 'System documentation and information for users', sources: [req('TR-1'), req('TR-4')] },
  { framework: 'iso42001', id: 'A.8.4', title: 'Communication of incidents', sources: [policy('incident-response')] },
  { framework: 'iso42001', id: 'A.9.2', title: 'Processes for responsible use of AI systems', sources: [policy('ai-acceptable-use'), check('github.ai_changes_reviewed')] },
  { framework: 'iso42001', id: 'A.9.4', title: 'Intended use of the AI system', sources: [req('HU-3'), check('ai.models_declared')] },
  { framework: 'iso42001', id: 'A.10.3', title: 'Suppliers', sources: [policy('information-security')] },

  // EU AI Act, Regulation (EU) 2024/1689
  { framework: 'euaiact', id: 'Art. 4', title: 'AI literacy', sources: [policy('ai-acceptable-use')] },
  { framework: 'euaiact', id: 'Art. 9', title: 'Risk management system', sources: [req('EM-6'), req('EM-7')] },
  { framework: 'euaiact', id: 'Art. 12', title: 'Record-keeping', sources: [req('HU-7'), req('CO-5')] },
  { framework: 'euaiact', id: 'Art. 13', title: 'Transparency and provision of information to deployers', sources: [req('EX-7'), req('TR-1')] },
  { framework: 'euaiact', id: 'Art. 14', title: 'Human oversight', sources: [policy('human-oversight'), req('HU-4'), req('HU-5')] },
  { framework: 'euaiact', id: 'Art. 26', title: 'Obligations of deployers of high-risk AI systems', sources: [req('HU-1'), req('HU-3'), check('ai.usage_fresh')] },
  { framework: 'euaiact', id: 'Art. 50', title: 'Transparency obligations for providers and deployers of certain AI systems', sources: [req('TR-1'), req('TR-2')] },
  { framework: 'euaiact', id: 'Art. 73', title: 'Reporting of serious incidents', sources: [policy('incident-response')] },
  { framework: 'euaiact', id: 'Art. 86', title: 'Right to explanation of individual decision-making', sources: [req('EX-1'), req('EX-4')] },

  { framework: 'iso27001', id: 'A.5.1', title: 'Policies for information security', sources: [policy('information-security')] },
  { framework: 'iso27001', id: 'A.5.10', title: 'Acceptable use of information and other associated assets', sources: [policy('ai-acceptable-use')] },
  { framework: 'iso27001', id: 'A.5.15', title: 'Access control', sources: [check('m365.global_admins')] },
  { framework: 'iso27001', id: 'A.5.17', title: 'Authentication information', sources: [check('github.no_exposed_secrets'), check('m365.mfa_registered')] },
  { framework: 'iso27001', id: 'A.5.18', title: 'Access rights', sources: [check('m365.stale_accounts')] },
  { framework: 'iso27001', id: 'A.5.24', title: 'Information security incident management planning and preparation', sources: [policy('incident-response')] },
  { framework: 'iso27001', id: 'A.8.2', title: 'Privileged access rights', sources: [check('m365.global_admins')] },
  { framework: 'iso27001', id: 'A.8.4', title: 'Access to source code', sources: [check('github.branch_protected'), check('github.no_exposed_secrets')] },
  { framework: 'iso27001', id: 'A.8.5', title: 'Secure authentication', sources: [check('github.org_2fa_required'), check('m365.mfa_enforced')] },
  { framework: 'iso27001', id: 'A.8.8', title: 'Management of technical vulnerabilities', sources: [check('github.no_critical_vulnerabilities')] },
  { framework: 'iso27001', id: 'A.8.25', title: 'Secure development life cycle', sources: [check('github.review_required')] },
  { framework: 'iso27001', id: 'A.8.32', title: 'Change management', sources: [check('github.branch_protected'), check('github.review_required'), check('github.merged_with_review'), check('github.ai_changes_reviewed')] },

  { framework: 'popia', id: 's19', title: 'Security measures on integrity and confidentiality of personal information', sources: [policy('information-security'), check('github.no_critical_vulnerabilities'), check('github.no_exposed_secrets'), check('m365.mfa_enforced')] },
  { framework: 'popia', id: 's22', title: 'Notification of security compromises', sources: [policy('incident-response')] },
  { framework: 'popia', id: 's71', title: 'Automated decision making', sources: [policy('human-oversight'), req('HU-1'), req('HU-2'), check('github.ai_usage_declared'), check('ai.models_declared')] },
];

export type SourceStatus = 'pass' | 'fail' | 'pending' | 'none';
export type ControlStatus = 'evidenced' | 'partial' | 'gap' | 'no_evidence';

export type EvidenceInput = {
  /** check key → statuses across subjects */
  checks: Record<string, string[]>;
  /** policy template key → { id, published, acceptedAll } */
  policies: Record<string, { id: string; published: boolean; acceptedAll: boolean }>;
  /** requirement code → vault state */
  requirements: Record<string, { id: string; state: string; text: string; right: string | null }>;
};

export type EvaluatedSource = { label: string; status: SourceStatus; href: string };
export type EvaluatedControl = { framework: Framework; id: string; title: string; status: ControlStatus; sources: EvaluatedSource[] };

export function sourceStatus(s: Source, e: EvidenceInput): EvaluatedSource {
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
  const r = e.requirements[s.code];
  const status: SourceStatus = !r ? 'none' : r.state === 'accepted' ? 'pass' : r.state === 'needs_more' ? 'fail' : r.state === 'submitted' ? 'pending' : 'none';
  return { label: s.code, status, href: '/evidence' };
}

export function rollUp(statuses: SourceStatus[]): ControlStatus {
  if (statuses.includes('fail')) return 'gap';
  if (statuses.length > 0 && statuses.every((s) => s === 'pass')) return 'evidenced';
  if (statuses.some((s) => s === 'pass' || s === 'pending')) return 'partial';
  return 'no_evidence';
}

export function evaluateControls(e: EvidenceInput, checkTitle: (k: string) => string, policyTitle: (k: string) => string): EvaluatedControl[] {
  const fixed = CONTROLS.map((c) => {
    const sources = c.sources.map((s) => {
      const ev = sourceStatus(s, e);
      const label = s.kind === 'check' ? checkTitle(s.key) : s.kind === 'policy' ? policyTitle(s.key) : `${s.code} evidence`;
      return { ...ev, label };
    });
    return { framework: c.framework, id: c.id, title: c.title, status: rollUp(sources.map((s) => s.status)), sources };
  });

  // The AIC standard: one control per requirement that applies to the
  // organisation, evidenced by the vault and by any check or policy that
  // names the requirement code.
  const aic = Object.entries(e.requirements)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([code, r]) => {
      const sources: EvaluatedSource[] = [{ ...sourceStatus(req(code), e), label: 'Evidence filed in the vault' }];
      return { framework: 'aic' as const, id: code, title: r.text, status: rollUp(sources.map((s) => s.status)), sources };
    });
  return [...aic, ...fixed];
}
