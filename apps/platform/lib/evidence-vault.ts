/**
 * The Evidence Vault, built from what is actually on record.
 *
 * It replaces a component that rendered five hard-coded "Rights" with fixed
 * scores (71, 88, 54…), invented evidence notes ("47 override events") and a
 * fourteen-day deadline nobody set. Every figure here is now a count of rows:
 * the requirements that apply to the organisation's Division, the evidence
 * submitted against each, and what an AIC assessor concluded about it.
 *
 * There is no score. The published standard defines how evidence tiers weigh,
 * but a weighted number on this page would read as a verdict, and only an
 * assessment produces one.
 */

export type EvidenceState = 'missing' | 'submitted' | 'accepted' | 'needs_more';

export type VaultDocument = {
  id: string;
  title: string;
  fileSize: string | null;
  createdAt: string | null;
  verificationOutcome: string | null;
  verificationNotes: string | null;
  verifiedAt: string | null;
  supersededBy: string | null;
};

export type VaultRequirement = {
  id: string;
  code: string | null;
  rightCode: string | null;
  text: string;
  evidenceGuidance: string | null;
  tier: string | null;
  state: EvidenceState;
  documents: VaultDocument[];
};

/**
 * What a requirement's evidence amounts to, from its latest live document.
 * "Latest live" is the newest one not superseded: a rejected file followed by
 * a fresh upload is "submitted" again, not "needs more".
 */
export function evidenceState(docs: VaultDocument[]): EvidenceState {
  const live = docs.filter((d) => !d.supersededBy);
  if (live.length === 0) return 'missing';
  if (live.some((d) => d.verificationOutcome === 'ACCEPTED')) return 'accepted';
  const newest = [...live].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
  if (newest.verificationOutcome === 'REJECTED' || newest.verificationOutcome === 'INSUFFICIENT') return 'needs_more';
  return 'submitted';
}

export type RightSummary = { code: string; name: string | null; blurb: string | null; total: number; accepted: number; submitted: number; needsMore: number; missing: number };

export function summariseByRight(
  reqs: VaultRequirement[],
  rights: Partial<Record<string, { name: string; blurb: string }>> | undefined
): RightSummary[] {
  const order = ['HU', 'EX', 'EM', 'CO', 'TR'];
  const codes = [...new Set(reqs.map((r) => r.rightCode ?? 'OTHER'))].sort(
    (a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b))
  );
  return codes.map((code) => {
    const rs = reqs.filter((r) => (r.rightCode ?? 'OTHER') === code);
    return {
      code,
      name: rights?.[code]?.name ?? null,
      blurb: rights?.[code]?.blurb ?? null,
      total: rs.length,
      accepted: rs.filter((r) => r.state === 'accepted').length,
      submitted: rs.filter((r) => r.state === 'submitted').length,
      needsMore: rs.filter((r) => r.state === 'needs_more').length,
      missing: rs.filter((r) => r.state === 'missing').length,
    };
  });
}
