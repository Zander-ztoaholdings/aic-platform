'use client';

import { TriageNote } from '@/app/components/ui/TriageNote';
import type { Triage } from '@/lib/ai/triage-shared';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Upload, Download } from 'lucide-react';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { UploadModal } from '@/app/components/ui/UploadModal';
import type { VaultRequirement, RightSummary, EvidenceState } from '@/lib/evidence-vault';

/**
 * The Evidence Vault: the requirements that apply to this organisation's
 * Division, and the evidence filed against each. Every number on this page is
 * a count of real rows; see lib/evidence-vault.ts for why there is no score.
 */

type VaultData = {
  division: number | null;
  standardVersion: string | null;
  canSubmit: boolean;
  canSeed: boolean;
  rights: RightSummary[];
  tiers: Record<string, { label: string; desc: string }> | null;
  requirements: VaultRequirement[];
  unlinked: { id: string; title: string }[];
};

const STATE: Record<EvidenceState, { label: string; pill: string }> = {
  missing: { label: 'Nothing filed', pill: 'text-[#5e6b7b] bg-[#f5f7f9]' },
  submitted: { label: 'Waiting for review', pill: 'text-[#8a6a1f] bg-[#a8772a]/10' },
  needs_more: { label: 'Needs more', pill: 'text-[#b45309] bg-[#b45309]/10' },
  accepted: { label: 'Accepted', pill: 'text-[#2e7a57] bg-[#2e7a57]/10' },
};

const OUTCOME_LABEL: Record<string, string> = { ACCEPTED: 'Accepted', REJECTED: 'Rejected', INSUFFICIENT: 'Not enough' };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function EvidenceVault() {
  const [data, setData] = useState<VaultData | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [upload, setUpload] = useState<VaultRequirement | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/evidence/vault', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || 'The vault could not be loaded.'); return; }
    setData(body);
    setError('');
    setOpen((o) => o ?? (body.rights.find((r: RightSummary) => r.missing + r.needsMore > 0)?.code ?? null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function seed() {
    setSeeding(true);
    const res = await fetch('/api/evidence/vault/seed', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setSeeding(false);
    if (!res.ok) { setError(body.error || 'The requirements could not be loaded.'); return; }
    load();
  }

  const total = data?.requirements.length ?? 0;
  const accepted = data?.requirements.filter((r) => r.state === 'accepted').length ?? 0;

  return (
    <div className="max-w-[1100px] space-y-7">
      {upload && (
        <UploadModal
          label={upload.code ? `${upload.code} — ${upload.text}` : upload.text}
          slotType={upload.code ?? undefined}
          requirementId={upload.id}
          onClose={() => setUpload(null)}
          onUploaded={load}
        />
      )}

      <header>
        <Eyebrow>Compliance tracking</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Evidence Vault</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
          The requirements of the AIC standard that apply to your Division, and the evidence you have filed against each. An AIC assessor reviews
          every file and records what they concluded.
        </p>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
      {!data && !error && <p className="text-[14px] text-[#5e6b7b]">Loading…</p>}

      {data && total === 0 && (
        <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6">
          <p className="text-[15px] font-medium text-[#0e1b2c]">No requirements are on record for your organisation yet.</p>
          {data.canSeed ? (
            <>
              <p className="mt-1 text-[14px] text-[#5e6b7b]">
                Load the requirements that apply to Division {data.division} from the published standard. This is done once.
              </p>
              <button onClick={seed} disabled={seeding} className="mt-4 h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-50">
                {seeding ? 'Loading…' : `Load the Division ${data.division} requirements`}
              </button>
            </>
          ) : (
            <p className="mt-1 text-[14px] text-[#5e6b7b]">
              {data.division ? 'An organisation admin can load them here.' : 'Your organisation has no Division recorded yet. AIC sets it when your application is accepted.'}
            </p>
          )}
        </div>
      )}

      {data && total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <p className="text-[15px] text-[#0e1b2c]">
              <span className="font-semibold">{accepted} of {total}</span> requirements have accepted evidence
              {data.standardVersion ? <span className="text-[#5e6b7b]"> (standard {data.standardVersion}, Division {data.division})</span> : null}.
            </p>

            <section className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden">
              {data.rights.map((right) => {
                const isOpen = open === right.code;
                const reqs = data.requirements.filter((r) => (r.rightCode ?? 'OTHER') === right.code);
                return (
                  <div key={right.code}>
                    <button onClick={() => setOpen(isOpen ? null : right.code)} aria-expanded={isOpen} className="w-full text-left px-4 sm:px-5 py-4 hover:bg-[#fafbfc]">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[12.5px] font-medium text-[#8a6a1f]">{right.code}</span>
                            <span className="text-[16px] font-semibold text-[#0e1b2c]">{right.name ?? right.code}</span>
                          </div>
                          {right.blurb && <p className="text-[13.5px] text-[#5e6b7b] mt-0.5">{right.blurb}</p>}
                          {/* One brass line per Right: accepted over total. A count, drawn, not a score. */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden max-w-[320px]" aria-hidden>
                              <div className="h-full bg-[#a8772a]" style={{ width: `${(right.accepted / right.total) * 100}%` }} />
                            </div>
                            <span className="text-[13px] text-[#5e6b7b] tabular-nums shrink-0">
                              {right.accepted}/{right.total} accepted
                              {right.needsMore > 0 && <span className="text-[#b45309]">, {right.needsMore} need more</span>}
                            </span>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 mt-1 text-[#8a95a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isOpen && (
                      <ul className="px-4 sm:px-5 pb-4 space-y-2">
                        {reqs.map((r) => (
                          <li key={r.id} className="rounded-xl border border-[#e6e9ee] p-3.5 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {r.code && <span className="text-[13px] font-semibold text-[#0e1b2c] tabular-nums">{r.code}</span>}
                                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${STATE[r.state].pill}`}>{STATE[r.state].label}</span>
                                  {r.tier && (
                                    <span className="text-[12px] text-[#5e6b7b]">
                                      Tier {r.tier}{data.tiers?.[r.tier] ? `: ${data.tiers[r.tier].label.toLowerCase()}` : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-[14px] leading-relaxed text-[#0e1b2c]">{r.text}</p>
                                {r.evidenceGuidance && <p className="mt-1 text-[13px] text-[#5e6b7b]">What counts: {r.evidenceGuidance}</p>}
                              </div>
                              {data.canSubmit && (
                                <button
                                  onClick={() => setUpload(r)}
                                  className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3.5 rounded-full border border-[#d5dbe2] text-[13.5px] font-medium text-[#0e1b2c] hover:border-[#a8772a] shrink-0"
                                >
                                  <Upload className="w-3.5 h-3.5" /> {r.documents.length ? 'File more' : 'File evidence'}
                                </button>
                              )}
                            </div>

                            {r.documents.length > 0 && (
                              <ul className="mt-3 pt-3 border-t border-[#eef1f5] space-y-2">
                                {r.documents.map((d) => (
                                  <li key={d.id} className="text-[13px]">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                      <a href={`/api/evidence/${d.id}/file`} className="inline-flex items-center gap-1.5 text-[#0e1b2c] hover:text-[#8a6a1f] min-w-0">
                                        <Download className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{d.title}</span>
                                      </a>
                                      <span className="text-[#8a95a3]">filed {fmtDate(d.createdAt)}</span>
                                      {d.verificationOutcome && (
                                        <span className={d.verificationOutcome === 'ACCEPTED' ? 'text-[#2e7a57]' : 'text-[#b45309]'}>
                                          {OUTCOME_LABEL[d.verificationOutcome] ?? d.verificationOutcome} {fmtDate(d.verifiedAt)}
                                        </span>
                                      )}
                                    </div>
                                    {d.verificationNotes && <p className="mt-1 text-[13px] text-[#5e6b7b] sm:pl-5">Assessor: {d.verificationNotes}</p>}
                                    {!d.verificationOutcome && !d.supersededBy && (d as { triage?: Triage | null }).triage && <div className="mt-2 sm:pl-5"><TriageNote compact triage={(d as { triage?: Triage | null }).triage!} /></div>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>

            {data.unlinked.length > 0 && (
              <p className="text-[13px] text-[#5e6b7b]">
                {data.unlinked.length} earlier file{data.unlinked.length === 1 ? ' was' : 's were'} filed without a requirement and {data.unlinked.length === 1 ? 'is' : 'are'} not counted above.
              </p>
            )}
          </div>

          <aside className="space-y-4">
            {data.tiers && (
              <div className="bg-white border border-[#dde2e8] rounded-xl p-5">
                <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Evidence tiers</h2>
                <p className="mt-1 text-[13px] text-[#5e6b7b]">Each requirement says which kind of evidence it expects. Stronger kinds carry more weight in an assessment.</p>
                <dl className="mt-3 space-y-2.5">
                  {Object.entries(data.tiers).map(([t, v]) => (
                    <div key={t}>
                      <dt className="text-[13px] font-semibold text-[#0e1b2c]">Tier {t}: {v.label}</dt>
                      <dd className="text-[12.5px] leading-relaxed text-[#5e6b7b]">{v.desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="bg-white border border-[#dde2e8] rounded-xl p-5">
              <h2 className="text-[14px] font-semibold text-[#0e1b2c]">How review works</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">
                A named AIC assessor opens each file, checks it is the file you filed (its fingerprint is compared with the one taken at upload),
                and records whether it is accepted or what is missing. A file is never edited or deleted; a better one is filed alongside it.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
