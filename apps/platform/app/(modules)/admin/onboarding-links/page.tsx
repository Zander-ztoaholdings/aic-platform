'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Mail } from 'lucide-react';
import AdminShell from '@/app/components/admin/AdminShell';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { Pill, field } from '@/app/components/admin/ui';

type LinkRow = {
  id: string; url: string; orgName: string | null; contactName: string | null; contactEmail: string | null; leadName: string | null;
  note: string | null; uses: number; maxUses: number; expiresAt: string; createdAt: string; lastUsedAt: string | null;
  state: 'open' | 'used' | 'expired' | 'revoked'; emailedAt: string | null; emailCount: number; emailBlocked: string | null;
};
type Lead = { id: string; name: string; role: string };

const STATE: Record<LinkRow['state'], { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'gold' }> = {
  open: { label: 'Waiting for the client', tone: 'gold' },
  used: { label: 'Used', tone: 'good' },
  expired: { label: 'Expired', tone: 'neutral' },
  revoked: { label: 'Withdrawn', tone: 'neutral' },
};
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const blank = { orgName: '', contactName: '', contactEmail: '', preferredLeadId: '', note: '', days: '14', maxUses: '1', email: true };

/**
 * Links AIC staff send a prospective client. The link opens a welcome page
 * and registration with the details below filled in; on registration the
 * client's AIC lead is assigned (the one chosen here when they may hold the
 * file, otherwise the default rule).
 */
export default function OnboardingLinksPage() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState('');
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ url: string; emailed: { sent: boolean; to?: string; reason?: string } | null } | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [copied, setCopied] = useState('');

  const load = useCallback(() => {
    fetch('/api/v1/admin/onboarding-links', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? 'Could not load the links.'); setLinks([]); return; }
      setLinks(j.links); setLeads(j.leads);
    });
  }, []);
  useEffect(load, [load]);

  const copy = (k: string, t: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1500); });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(''); setMade(null);
    if (f.email && !f.contactEmail.trim()) { setBusy(false); setError('Add the contact’s email address, or untick “Email it”.'); return; }
    const r = await fetch('/api/v1/admin/onboarding-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, preferredLeadId: f.preferredLeadId || null, email: f.email && !!f.contactEmail.trim() }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error ?? 'Could not create the link.'); return; }
    setMade({ url: j.url, emailed: j.emailed }); setF(blank); load();
  }

  async function emailIt(id: string) {
    setRowMsg((m) => ({ ...m, [id]: { ok: true, text: 'Sending…' } }));
    const r = await fetch(`/api/v1/admin/onboarding-links/${id}/email`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setRowMsg((m) => ({ ...m, [id]: r.ok ? { ok: true, text: `Emailed to ${j.to}.` } : { ok: false, text: j.error ?? 'Could not send it.' } }));
    if (r.ok) load();
  }

  async function withdraw(id: string) {
    const r = await fetch(`/api/v1/admin/onboarding-links/${id}`, { method: 'DELETE' });
    if (r.ok) load();
  }

  const label = 'block text-[13px] font-medium text-[#0e1b2c]';
  return (
    <AdminShell>
      <header className="mb-8">
        <Eyebrow>Register</Eyebrow>
        <h1 className="font-serif text-[30px] font-semibold leading-tight text-[#0e1b2c] md:text-[34px]">Client onboarding links</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#5e6b7b]">AIC emails the client a link from aiccertified.cloud, with replies coming to you, so it arrives from a sender they can check rather than as a bare link. It opens a short welcome and registration with their details filled in, and gives them an AIC assessor the moment they register.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={create} className="space-y-3.5 rounded-2xl border border-[#dde2e8] bg-white p-5">
          <h2 className="text-[15px] font-semibold text-[#0e1b2c]">New link</h2>
          <label className={label}>Organisation<input className={`${field} mt-1`} value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} placeholder="As the client calls itself" /></label>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-1">
            <label className={label}>Contact name<input className={`${field} mt-1`} value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></label>
            <label className={label}>Contact email<input type="email" className={`${field} mt-1`} value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></label>
          </div>
          <label className={label}>Their AIC lead
            <select className={`${field} mt-1`} value={f.preferredLeadId} onChange={(e) => setF({ ...f, preferredLeadId: e.target.value })}>
              <option value="">Assign by the default rule</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <span className="mt-1 block text-[12px] font-normal text-[#5e6b7b]">If the person chosen has a conflict with the client when they register, the default rule picks someone else.</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Valid for (days)<input type="number" min={1} max={90} className={`${field} mt-1`} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></label>
            <label className={label}>Can be used<input type="number" min={1} max={100} className={`${field} mt-1`} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} /><span className="mt-1 block text-[12px] font-normal text-[#5e6b7b]">times</span></label>
          </div>
          <label className={label}>Note for AIC<textarea className={`${field} mt-1 h-20 py-2`} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Not shown to the client" /></label>
          <label className="flex items-start gap-2.5 text-[13.5px] text-[#0e1b2c]">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e1b2c]" checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} />
            <span><span className="font-medium">Email it to the contact from AIC</span><span className="block text-[12px] text-[#5e6b7b]">Sent from aiccertified.cloud. Their replies come to you.</span></span>
          </label>
          {error && <p className="text-[13px] text-[#b23a35]">{error}</p>}
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-[14px] font-medium text-white hover:bg-[#22344a] disabled:opacity-50"><Link2 className="h-4 w-4" />{busy ? 'Creating…' : f.email ? 'Create and email the link' : 'Create the link'}</button>
          {made && (
            <div className={`rounded-xl p-3 text-[13px] ${made.emailed && !made.emailed.sent ? 'bg-[#b45309]/[0.08] text-[#8a4a10]' : 'bg-[#2e7a57]/[0.07] text-[#1f5a40]'}`}>
              <p className="font-medium">{made.emailed?.sent ? `Emailed to ${made.emailed.to}` : made.emailed ? 'The link is ready, but it was not emailed' : 'Link ready'}</p>
              {made.emailed && !made.emailed.sent && <p className="mt-0.5">{made.emailed.reason}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-1.5 text-[#0e1b2c]">{made.url}</span>
                <button type="button" onClick={() => copy('new', made.url)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0e1b2c]" aria-label="Copy the link">{copied === 'new' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
              </div>
            </div>
          )}
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#dde2e8] bg-white">
          {!links ? <p className="p-5 text-[14px] text-[#5e6b7b]">Loading…</p> : links.length === 0 ? <p className="p-5 text-[14px] text-[#5e6b7b]">No links yet.</p> : (
            <ul className="divide-y divide-[#eef1f5]">
              {links.map((l) => (
                <li key={l.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold text-[#0e1b2c]">{l.orgName ?? 'Any organisation'}<Pill tone={STATE[l.state].tone}>{STATE[l.state].label}</Pill></p>
                    <p className="mt-0.5 text-[13px] text-[#5e6b7b]">{[l.contactName, l.contactEmail].filter(Boolean).join(', ') || 'No contact named'}{l.leadName ? `. Lead: ${l.leadName}` : '. Lead by the default rule'}</p>
                    <p className="mt-0.5 text-[12.5px] text-[#8a95a3]">Created {day(l.createdAt)}, {l.state === 'open' ? `valid until ${day(l.expiresAt)}` : l.state === 'used' ? `used ${l.lastUsedAt ? day(l.lastUsedAt) : ''}` : `until ${day(l.expiresAt)}`}{l.maxUses > 1 ? `, used ${l.uses} of ${l.maxUses} times` : ''}{l.emailedAt ? `. Emailed ${day(l.emailedAt)}${l.emailCount > 1 ? ` (${l.emailCount} times)` : ''}` : l.state === 'open' ? '. Not emailed yet' : ''}</p>
                    {rowMsg[l.id] && <p className={`mt-1 text-[12.5px] ${rowMsg[l.id].ok ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>{rowMsg[l.id].text}</p>}
                  </div>
                  {l.state === 'open' && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {l.contactEmail && <button type="button" disabled={!!l.emailBlocked} title={l.emailBlocked ?? undefined} onClick={() => emailIt(l.id)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-3.5 text-[13px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40"><Mail className="h-3.5 w-3.5" />{l.emailedAt ? 'Email it again' : 'Email it'}</button>}
                      <button type="button" onClick={() => copy(l.id, l.url)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#dde2e8] px-3.5 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">{copied === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy the link</button>
                      <button type="button" onClick={() => withdraw(l.id)} className="h-9 rounded-full px-3 text-[13px] text-[#5e6b7b] hover:text-[#b23a35]">Withdraw</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
