'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';

interface Badge {
  id: string; code: string; orgNameAtIssue: string; orgNameNow: string | null; accountablePerson: string | null;
  listed: boolean; issuedAt: string; expiresAt: string; revokedAt: string | null; revocationReason: string | null;
  questionSetVersion: string; status: 'valid' | 'expired' | 'revoked';
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const WEB = 'https://aiccertified.cloud';
const PILL: Record<Badge['status'], string> = {
  valid: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-red-50 text-red-700',
};

export default function AdminAwareBadges() {
  const [badges, setBadges] = useState<Badge[] | null>(null);
  const [canRevoke, setCanRevoke] = useState(false);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<Badge | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/aware/badges', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Could not load badges.'); return; }
    setBadges(data.badges); setCanRevoke(!!data.canRevoke); setError('');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    const res = await fetch(`/api/v1/admin/aware/badges/${revoking.code}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REVOKE', reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not revoke.'); return; }
    setRevoking(null); setReason(''); await load();
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0e1b2c]">AIC Aware badges</h1>
          <p className="text-sm text-gray-500 mt-1">Every badge issued, its status, and revocation. A revoked badge shows as revoked on its registry entry and on every site that embeds it.</p>
        </div>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-[12px] font-bold text-gray-500 first-cap">
              <tr>
                <th className="px-5 py-3">Code</th><th className="px-5 py-3">Organisation</th><th className="px-5 py-3">Accountable</th>
                <th className="px-5 py-3">Issued</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {badges === null && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>}
              {badges?.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No badges have been issued yet.</td></tr>}
              {badges?.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 align-top">
                  <td className="px-5 py-3 font-mono text-xs"><a href={`${WEB}/registry/aware/${b.code}`} target="_blank" rel="noreferrer" className="hover:underline">{b.code}</a></td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{b.orgNameAtIssue}</div>
                    {b.orgNameNow && b.orgNameNow !== b.orgNameAtIssue && <div className="text-xs text-gray-500">now {b.orgNameNow}</div>}
                    {b.listed && <div className="text-xs text-emerald-600">Listed in directory</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{b.accountablePerson ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmt(b.issuedAt)}</td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmt(b.expiresAt)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILL[b.status]}`}>{b.status}</span>
                    {b.revocationReason && <div className="mt-1 max-w-[220px] text-xs text-gray-500">{b.revocationReason}</div>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {canRevoke && !b.revokedAt && (
                      <button onClick={() => { setRevoking(b); setReason(''); }} className="text-xs font-semibold text-red-600 hover:underline">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {revoking && (
          <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5 space-y-3">
            <div className="text-sm font-semibold text-gray-900">Revoke {revoking.code} ({revoking.orgNameAtIssue})</div>
            <p className="text-xs text-gray-500">This cannot be undone. The reason is shown publicly on the badge&apos;s registry entry.</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Why this badge no longer stands, in words the public can read"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-300" />
            <div className="flex gap-2">
              <button onClick={revoke} disabled={busy || reason.trim().length < 10}
                className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Revoking…' : 'Revoke badge'}</button>
              <button onClick={() => setRevoking(null)} className="rounded-full px-4 py-2 text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
