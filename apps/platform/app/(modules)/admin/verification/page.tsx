'use client';

import { controlFromSlot, COMMON_BY_KEY } from '@/lib/common-controls';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import AdminShell from '../components/AdminShell';
import { Pill, Button, field, ago } from '@/app/components/admin/ui';

/**
 * Evidence review. The assessor picks an organisation, opens each file
 * (downloaded through AIC, which checks it against the fingerprint taken at
 * upload), and records an outcome. Anything other than "accepted" must say
 * what is wrong, because the organisation sees that note.
 *
 * Replaces a page that called /api/requirements, which only ever served the
 * caller's own organisation — so for staff, who have none, it showed nothing.
 */

type Org = { orgId: string; name: string; division: number | null; total: number; waiting: number; oldestWaiting: string | null };
type Doc = {
  id: string; title: string; fileSize: string | null; createdAt: string | null;
  verificationOutcome: string | null; verificationNotes: string | null; verifiedAt: string | null;
  slotType?: string | null; requirementCode: string | null; requirementText: string | null; evidenceGuidance: string | null; uploadedBy: string | null;
};

const OUTCOME_PILL: Record<string, { tone: 'good' | 'warn' | 'bad'; label: string }> = {
  ACCEPTED: { tone: 'good', label: 'Accepted' },
  INSUFFICIENT: { tone: 'warn', label: 'Not enough' },
  REJECTED: { tone: 'bad', label: 'Rejected' },
};

export default function VerificationPage() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting');
  const [error, setError] = useState('');

  const loadOrgs = useCallback(async () => {
    const res = await fetch('/api/v1/admin/evidence', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || 'Could not load the queue.'); return; }
    setOrgs(body.organisations);
    setOrgId((cur) => cur ?? body.organisations[0]?.orgId ?? null);
  }, []);

  const loadDocs = useCallback(async (id: string) => {
    setDocs(null);
    const res = await fetch(`/api/v1/admin/evidence?orgId=${id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || 'Could not load evidence.'); return; }
    setDocs(body.documents);
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);
  useEffect(() => { if (orgId) loadDocs(orgId); }, [orgId, loadDocs]);

  const shown = (docs ?? []).filter((d) => filter === 'all' || !d.verificationOutcome);
  const org = orgs?.find((o) => o.orgId === orgId);

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <Eyebrow>Assessments</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Evidence review</h1>
          <p className="mt-1 text-sm text-[#5e6b7b] max-w-2xl">
            Open each file, check it against the requirement it was filed for, and record what you concluded. The organisation sees the outcome and
            your note.
          </p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {orgs && orgs.length === 0 && <p className="text-sm text-[#5e6b7b]">No organisation has filed evidence yet.</p>}

        {orgs && orgs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
            <nav className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden" aria-label="Organisations">
              {orgs.map((o) => (
                <button
                  key={o.orgId}
                  onClick={() => setOrgId(o.orgId)}
                  className={`w-full text-left px-4 py-3 ${o.orgId === orgId ? 'bg-[#fbf7ee]' : 'hover:bg-[#fafbfc]'}`}
                >
                  <span className="block text-sm font-semibold text-[#0e1b2c]">{o.name}</span>
                  <span className="block text-[12.5px] text-[#5e6b7b]">
                    {o.waiting > 0 ? `${o.waiting} waiting, oldest ${ago(o.oldestWaiting)}` : 'Nothing waiting'}
                    {o.division ? `. Division ${o.division}` : ''}
                  </span>
                </button>
              ))}
            </nav>

            <section className="space-y-3 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#0e1b2c]">{org?.name}</h2>
                <div className="inline-flex rounded-full border border-[#dde2e8] bg-white p-1 self-start">
                  {(['waiting', 'all'] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`h-8 px-3.5 rounded-full text-[13px] font-medium ${filter === f ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b]'}`}>
                      {f === 'waiting' ? 'Waiting' : 'Everything'}
                    </button>
                  ))}
                </div>
              </div>
              {!docs && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
              {docs && shown.length === 0 && <p className="text-sm text-[#5e6b7b]">{filter === 'waiting' ? 'Nothing waiting for review.' : 'No evidence filed.'}</p>}
              {shown.map((d) => (
                <ReviewCard key={d.id} d={d} onDone={() => { if (orgId) loadDocs(orgId); loadOrgs(); }} />
              ))}
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function ReviewCard({ d, onDone }: { d: Doc; onDone: () => void }) {
  const [notes, setNotes] = useState(d.verificationNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [integrity, setIntegrity] = useState<string | null>(null);

  async function decide(outcome: 'ACCEPTED' | 'INSUFFICIENT' | 'REJECTED') {
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/v1/admin/evidence/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome, notes }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(body.error || 'Could not record the outcome.'); return; }
    onDone();
  }

  async function open() {
    const res = await fetch(`/api/evidence/${d.id}/file`);
    if (!res.ok) { setErr('The file could not be opened.'); return; }
    setIntegrity(res.headers.get('X-AIC-Integrity'));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = d.title;
    a.click();
    URL.revokeObjectURL(url);
  }

  const outcome = d.verificationOutcome ? OUTCOME_PILL[d.verificationOutcome] : null;
  return (
    <article className="bg-white border border-[#dde2e8] rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {d.requirementCode && <span className="text-sm font-semibold text-[#0e1b2c]">{d.requirementCode}</span>}
            {outcome ? <Pill tone={outcome.tone}>{outcome.label}</Pill> : <Pill tone="gold">Waiting</Pill>}
          </div>
          <p className="mt-1 text-sm text-[#0e1b2c]">{d.requirementText ?? (controlFromSlot(d.slotType) ? `Control: ${COMMON_BY_KEY[controlFromSlot(d.slotType)!].title}. ${COMMON_BY_KEY[controlFromSlot(d.slotType)!].evidence}` : 'Filed without a requirement')}</p>
          {d.evidenceGuidance && <p className="mt-0.5 text-[13px] text-[#5e6b7b]">Expects: {d.evidenceGuidance}</p>}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[13px]">
        <button onClick={open} className="inline-flex items-center gap-1.5 text-[#0e1b2c] hover:text-[#8a6a1f] min-w-0">
          <Download className="w-3.5 h-3.5 shrink-0" /> <span className="truncate underline decoration-[#d5dbe2] underline-offset-2">{d.title}</span>
        </button>
        <span className="text-[#8a95a3]">{d.fileSize} filed {ago(d.createdAt)}{d.uploadedBy ? ` by ${d.uploadedBy}` : ''}</span>
        {integrity === 'verified' && <span className="text-[#2e7a57]">Fingerprint matches</span>}
        {integrity === 'mismatch' && <span className="text-[#b23a35] font-medium">Fingerprint does not match what was filed</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="What you checked, or what is wrong or missing (required unless you accept)"
        className={field}
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="primary" disabled={busy} onClick={() => decide('ACCEPTED')}>Accept</Button>
        <Button disabled={busy} onClick={() => decide('INSUFFICIENT')}>Not enough</Button>
        <Button variant="danger" disabled={busy} onClick={() => decide('REJECTED')}>Reject</Button>
      </div>
      {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
    </article>
  );
}
