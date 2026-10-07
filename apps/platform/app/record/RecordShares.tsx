'use client';

import { useCallback, useEffect, useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { PeekView } from '@/app/components/ui/PeekView';

/**
 * Share a period of the record with one named person: an auditor, an
 * insurer, a board member, a customer. They get a link that opens only after
 * they prove their address with a one-time code, read live and watermarked,
 * never a file that could be edited and passed off as AIC's.
 */

type Share = {
  id: string; recipientName: string; recipientEmail: string; purpose: string | null;
  fromDate: string; toDate: string; expiresAt: string; createdAt: string;
  state: 'open' | 'expired' | 'withdrawn'; views: number; lastViewedAt: string | null;
};

const d = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00Z` : s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: s.length === 10 ? 'UTC' : undefined });
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const STATE: Record<Share['state'], { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'text-[#2e7a57] bg-[#2e7a57]/10' },
  expired: { label: 'Expired', tone: 'text-[#5e6b7b] bg-[#eef1f5]' },
  withdrawn: { label: 'Withdrawn', tone: 'text-[#b23a35] bg-[#b23a35]/10' },
};

export function RecordShares({ since }: { since: string | null }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [notReady, setNotReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/org/shares');
    if (!r.ok) { setShares([]); return; }
    const j = await r.json();
    setShares(j.shares); setCanShare(j.canShare); setNotReady(!!j.notReady);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function withdraw(s: Share) {
    if (!confirm(`Withdraw the link shared with ${s.recipientName}? It stops working straight away.`)) return;
    const r = await fetch(`/api/org/shares/${s.id}`, { method: 'DELETE' });
    if (r.ok) { setNotice(`The link shared with ${s.recipientName} is withdrawn.`); load(); }
  }

  if (notReady) return null;
  return (
    <section className="bg-white border border-[#dde2e8] rounded-2xl" id="shares">
      <header className="px-4 sm:px-6 py-4 border-b border-[#eef1f5] flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">Shared with</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">
            Share a period of this record with one named person, such as your auditor, insurer or board. It opens only for them, after a code sent to their email, and every view is logged here. AIC never issues the record as a file.
          </p>
        </div>
        {canShare && (
          <button type="button" onClick={() => { setOpen(true); setLink(''); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0e1b2c] px-4 text-[14px] font-semibold text-white hover:bg-[#22344a]">
            <Share2 className="h-4 w-4" /> Share a period
          </button>
        )}
      </header>
      {notice && <p className="mx-4 sm:mx-6 mt-4 rounded-xl bg-[#f5f7f9] px-3.5 py-2.5 text-[13.5px] text-[#0e1b2c]">{notice}</p>}
      {link && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 rounded-xl border border-[#dde2e8] px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-[12.5px] text-[#2b3a4d]">{link}</code>
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#dde2e8] px-3 text-[13px] font-medium">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      )}
      {shares === null ? (
        <p className="px-4 sm:px-6 py-5 text-[13.5px] text-[#5e6b7b]">Loading…</p>
      ) : shares.length === 0 ? (
        <p className="px-4 sm:px-6 py-5 text-[13.5px] text-[#5e6b7b]">Nothing shared yet.</p>
      ) : (
        <ul className="divide-y divide-[#eef1f5]">
          {shares.map((s) => (
            <li key={s.id} className="px-4 sm:px-6 py-3.5 grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <p className="text-[14.5px] font-medium text-[#0e1b2c]">{s.recipientName} <span className="font-normal text-[#5e6b7b] break-all">({s.recipientEmail})</span></p>
                <p className="text-[13px] text-[#5e6b7b]">{d(s.fromDate)} to {d(s.toDate)}{s.purpose ? `, for ${s.purpose}` : ''}. {s.state === 'open' ? `Open until ${d(s.expiresAt)}.` : ''}</p>
                <p className="text-[12.5px] text-[#8a95a3]">{s.views ? `Opened ${s.views} ${s.views === 1 ? 'time' : 'times'}, last ${d(s.lastViewedAt!)}` : 'Not opened yet'}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${STATE[s.state].tone}`}>{STATE[s.state].label}</span>
                {canShare && s.state === 'open' && <button type="button" onClick={() => withdraw(s)} className="min-h-[36px] text-[13px] font-medium text-[#b23a35] hover:underline">Withdraw</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <ShareForm since={since} onClose={() => setOpen(false)} onDone={(m, url) => { setOpen(false); setNotice(m); setLink(url); load(); }} />}
    </section>
  );
}

function ShareForm({ since, onClose, onDone }: { since: string | null; onClose: () => void; onDone: (msg: string, url: string) => void }) {
  const [v, setV] = useState({ recipientName: '', recipientEmail: '', purpose: '', fromDate: since ? since.slice(0, 10) : daysAgo(90), toDate: today(), days: '14' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function send() {
    setBusy(true); setErr('');
    const r = await fetch('/api/org/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, days: Number(v.days) }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not share.'); return; }
    onDone(j.message, j.url);
  }

  const field = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';
  return (
    <PeekView title="Share a period of the record" onClose={onClose} size="md" footer={<>
      <button type="button" onClick={send} disabled={busy || !v.recipientName.trim() || !v.recipientEmail.trim()} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Sharing…' : 'Share and email the link'}</button>
      <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
    </>}>
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-[#5e6b7b]">The link opens only for this person. They enter their email and the code AIC sends to it, then see the entries from the period you choose, live, with their address watermarked across the page.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Their full name<input className={field} value={v.recipientName} onChange={set('recipientName')} placeholder="e.g. Naledi Khumalo" /></label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Their email<input type="email" className={field} value={v.recipientEmail} onChange={set('recipientEmail')} placeholder="name@auditor.co.za" /></label>
        </div>
        <label className="block text-[13px] font-medium text-[#0e1b2c]">What it is for <span className="font-normal text-[#8a95a3]">(optional)</span><input className={field} value={v.purpose} onChange={set('purpose')} placeholder="e.g. Annual insurance renewal" /></label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-[13px] font-medium text-[#0e1b2c]">From<input type="date" className={field} value={v.fromDate} max={v.toDate} onChange={set('fromDate')} /></label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">To<input type="date" className={field} value={v.toDate} max={today()} onChange={set('toDate')} /></label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Link stays open
            <select className={field} value={v.days} onChange={set('days')}>
              {[['1', '1 day'], ['7', '7 days'], ['14', '14 days'], ['30', '30 days'], ['90', '90 days']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        {err && <p role="alert" className="text-[13.5px] text-[#b23a35]">{err}</p>}
      </div>
    </PeekView>
  );
}
