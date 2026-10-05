'use client';

import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { useCallback, useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { Pill, Button, field } from '@/app/components/admin/ui';

/**
 * Issued certificates and their lifecycle.
 *
 * This page used to render five hard-coded "Example Bank Ltd (demo)"
 * certificates with invented integrity scores. It now reads
 * issued_certifications. Suspension, reinstatement and revocation go through
 * the existing lifecycle route, which requires a reason and records who.
 */

type Cert = {
  id: string; certNumber: string; standard: string | null; status: string | null;
  issueDate: string | null; expiryDate: string; suspensionReason: string | null; revocationReason: string | null;
  organisation: string | null; division: number | null;
};

const DAY = 86_400_000;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function effective(c: Cert): { key: string; label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  const left = new Date(c.expiryDate).getTime() - Date.now();
  if (c.status === 'REVOKED') return { key: 'revoked', label: 'Revoked', tone: 'bad' };
  if (c.status === 'SUSPENDED') return { key: 'suspended', label: 'Suspended', tone: 'warn' };
  if (c.status === 'EXPIRED' || left < 0) return { key: 'expired', label: 'Expired', tone: 'neutral' };
  if (left < 60 * DAY) return { key: 'expiring', label: `Expires in ${Math.ceil(left / DAY)} days`, tone: 'warn' };
  return { key: 'active', label: 'Active', tone: 'good' };
}

export default function CertificationsPage() {
  const [certs, setCerts] = useState<Cert[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/certifications', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || 'Could not load certificates.'); return; }
    setCerts(body.certificates);
    setCanManage(body.canManageLifecycle);
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts: Record<string, number> = {};
  for (const c of certs ?? []) counts[effective(c).key] = (counts[effective(c).key] ?? 0) + 1;
  const shown = (certs ?? []).filter((c) => filter === 'all' || effective(c).key === filter);
  const FILTERS: [string, string][] = [['all', 'All'], ['active', 'Active'], ['expiring', 'Expiring soon'], ['suspended', 'Suspended'], ['expired', 'Expired'], ['revoked', 'Revoked']];

  return (
    <AdminShell>
      <div className="space-y-6">
        <header>
          <Eyebrow>Register</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Certificates</h1>
          <p className="mt-1 text-sm text-[#5e6b7b] max-w-2xl">Every certificate AIC has issued. A suspension or revocation needs a reason and is shown on the public register.</p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {certs && certs.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-sm text-[#5e6b7b]">
            No certificates have been issued yet. A certificate is issued from an organisation’s completed assessment.
          </div>
        )}
        {certs && certs.length > 0 && (
          <>
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
              {FILTERS.map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)} className={`h-9 px-3.5 rounded-full text-[13px] font-medium whitespace-nowrap border ${filter === k ? 'bg-[#0e1b2c] text-white border-[#0e1b2c]' : 'bg-white text-[#5e6b7b] border-[#dde2e8]'}`}>
                  {label} {k === 'all' ? certs.length : counts[k] ?? 0}
                </button>
              ))}
            </div>
            <div className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
              {shown.map((c) => <CertRow key={c.id} c={c} canManage={canManage} onDone={load} />)}
              {shown.length === 0 && <p className="p-5 text-sm text-[#5e6b7b]">None in this group.</p>}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function CertRow({ c, canManage, onDone }: { c: Cert; canManage: boolean; onDone: () => void }) {
  const [action, setAction] = useState<'SUSPEND' | 'REINSTATE' | 'REVOKE' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const st = effective(c);

  async function submit() {
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/v1/certifications/${encodeURIComponent(c.certNumber)}/lifecycle`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reason }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(body.message || body.error || 'That change was refused.'); return; }
    setAction(null);
    setReason('');
    onDone();
  }

  return (
    <div className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-[#0e1b2c]">{c.organisation ?? 'Organisation removed'}</span>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          <p className="mt-1 text-[13px] text-[#5e6b7b]">
            {c.certNumber}. {c.standard ?? 'AIC standard'}{c.division ? `, Division ${c.division}` : ''}. Issued {fmt(c.issueDate)}, expires {fmt(c.expiryDate)}.
          </p>
          {(c.suspensionReason || c.revocationReason) && (
            <p className="mt-1 text-[13px] text-[#b45309]">Reason: {c.revocationReason ?? c.suspensionReason}</p>
          )}
        </div>
        {canManage && st.key !== 'revoked' && (
          <div className="flex gap-2 shrink-0">
            {c.status === 'SUSPENDED'
              ? <Button onClick={() => setAction('REINSTATE')}>Reinstate</Button>
              : <Button onClick={() => setAction('SUSPEND')}>Suspend</Button>}
            <Button variant="danger" onClick={() => setAction('REVOKE')}>Revoke</Button>
          </div>
        )}
      </div>
      {action && (
        <div className="rounded-xl border border-[#e7d9b8] bg-[#fbf7ee] p-4 space-y-2">
          <p className="text-[13px] font-semibold text-[#0e1b2c]">
            {action === 'REVOKE' ? 'Revoke this certificate. This cannot be undone.' : action === 'SUSPEND' ? 'Suspend this certificate.' : 'Reinstate this certificate.'}
          </p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="The reason, as it will be recorded (at least 10 characters)" className={field} />
          <div className="flex gap-2">
            <Button variant={action === 'REVOKE' ? 'danger' : 'primary'} disabled={busy || reason.trim().length < 10} onClick={submit}>Confirm</Button>
            <Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button>
          </div>
          {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
        </div>
      )}
    </div>
  );
}
