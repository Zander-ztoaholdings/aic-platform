'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { CONNECTORS as ALL_CONNECTORS } from '@/lib/connectors/catalog';
import { CATEGORY_LABEL, type ConnectorCategory, type ConnectorDef } from '@/lib/connectors/types';
import { Portal } from '@/app/components/ui/Portal';
import { ago, type Integration, type Check } from './useIntegrations';
import { VendorLogo } from '@/app/components/ui/VendorLogo';
import { AI_PRODUCTS } from '@/lib/ai-use/products';
import { AiUseNotes } from './AiUse';

/**
 * Every other system AIC can read, as a catalogue: search, filter by kind,
 * open one to see exactly what it reads and how to create the read-only
 * credential, then connect it.
 */

const chip = (on: boolean) => `inline-flex min-h-[34px] items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${on ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`;
const STATUS_TONE: Record<string, string> = { pass: 'text-[#2e7a57]', fail: 'text-[#b23a35]', warn: 'text-[#b45309]', unknown: 'text-[#8a95a3]' };
const STATUS_WORD: Record<string, string> = { pass: 'Passing', fail: 'Failing', warn: 'Worth a look', unknown: 'Could not check' };

function state(i: Integration | undefined) {
  if (!i) return null;
  if (i.status === 'active') return { label: 'Connected', tone: 'text-[#2e7a57] bg-[#2e7a57]/10' };
  if (i.status === 'error') return { label: 'Needs attention', tone: 'text-[#b45309] bg-[#b45309]/10' };
  if (i.status === 'disconnected') return { label: 'Access withdrawn', tone: 'text-[#b23a35] bg-[#b23a35]/10' };
  return { label: 'Checking', tone: 'text-[#8a6a1f] bg-[#a8772a]/10' };
}

function Drawer({ def, i, checks, canManage, microsoftConnected, onClose, onDone }: {
  def: ConnectorDef; i?: Integration; checks: Check[]; canManage: boolean; microsoftConnected: boolean; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(def.fields.map((f) => [f.key, f.kind === 'select' ? f.options?.[0]?.value ?? '' : ''])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const connected = !!i && i.status !== 'disconnected';
  const [editing, setEditing] = useState(!connected);
  const blocked = def.uses === 'microsoft' && !microsoftConnected;
  const missing = def.fields.filter((f) => !f.optional && f.kind !== 'select' && !values[f.key]?.trim());

  async function connect() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/integrations/connectors/${def.key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: values }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not connect.'); return; }
    onDone(`${def.name} is connected. AIC ran ${j.checks} check${j.checks === 1 ? '' : 's'}${j.people !== null && j.people !== undefined ? ` and brought in ${j.people} people` : ''}.`);
  }
  async function disconnect() {
    setBusy(true); setErr('');
    const r = await fetch(`/api/integrations/connectors/${def.key}`, { method: 'DELETE' });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not disconnect.'); return; }
    onDone(`${def.name} is disconnected and its credential deleted.`);
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={def.name}>
      <div className="absolute inset-0 bg-[#0e1b2c]/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-[-12px_0_40px_-12px_rgba(10,23,40,0.25)]">
        <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <VendorLogo id={def.key} name={def.name} size={40} />
            <div className="min-w-0">
              <h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">{def.name}</h2>
              <p className="text-[12.5px] text-[#5e6b7b]">{CATEGORY_LABEL[def.category]}{i?.accountLabel && connected ? `, ${i.accountLabel}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-[14px]">
          <p className="leading-relaxed text-[#0e1b2c]">{def.reads} AIC only reads; it never changes anything.</p>
          {!def.verified && <p className="rounded-xl bg-[#a8772a]/[0.07] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#6f5418]">New connector, built from {def.name}’s documentation. If something reads wrong once it is connected, tell AIC and it will be fixed quickly.</p>}
          {def.plan && <p className="text-[13px] text-[#5e6b7b]">{def.plan}</p>}

          {def.ai && (
            <section className="rounded-xl bg-[#f5f7f9] px-4 py-3.5">
              <h3 className="text-[15px] font-semibold text-[#0e1b2c]">AI use it records</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#2b3a4d]">
                {def.ai.products.map((p) => AI_PRODUCTS[p].name).join(' and ')}: {AI_PRODUCTS[def.ai.products[0]].subject === 'person' ? 'who uses it and how often' : 'which models are called, and how much, per day'}. Counts only, never what anyone wrote.
              </p>
              {def.ai.needs && <p className="mt-1 text-[13px] text-[#5e6b7b]">Needs: {def.ai.needs}</p>}
              {connected && i && <AiUseNotes i={i} checks={checks} />}
            </section>
          )}

          {connected && i && (
            <section>
              <h3 className="text-[15px] font-semibold text-[#0e1b2c]">{def.checks.length ? 'Latest results' : 'Latest read'}</h3>
              <p className="mt-0.5 text-[12.5px] text-[#8a95a3]">Read {ago(i.lastSyncedAt)}{i.secretHint ? `, credential ending ${i.secretHint.replace('…', '')}` : ''}.</p>
              {i.lastError && <p className="mt-2 rounded-lg bg-[#b45309]/[0.07] px-3 py-2 text-[13px] text-[#8a4a10]">{i.lastError}</p>}
              <ul className="mt-2 divide-y divide-[#eef1f5]">
                {def.checks.map((c) => {
                  const r = checks.find((x) => x.checkKey === c.key);
                  return (
                    <li key={c.key} className="py-2.5">
                      <p className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-[#0e1b2c]">{c.title}</span>{r && <span className={`text-[12.5px] font-medium ${STATUS_TONE[r.status]}`}>{STATUS_WORD[r.status]}</span>}</p>
                      {r && <p className="mt-0.5 text-[13px] text-[#5e6b7b]">{r.summary}</p>}
                      {r?.status === 'fail' && <p className="mt-1 text-[13px] text-[#0e1b2c]">{c.fix}</p>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {!connected && (
            <section>
              <h3 className="text-[15px] font-semibold text-[#0e1b2c]">What AIC checks</h3>
              <ul className="mt-2 space-y-2">
                {def.checks.map((c) => <li key={c.key}><span className="font-medium text-[#0e1b2c]">{c.title}.</span> <span className="text-[#5e6b7b]">{c.why}</span></li>)}
              </ul>
              {def.checks.length === 0 && <p className="mt-1 text-[13.5px] text-[#5e6b7b]">It records AI use, and checks that each product people use is on your AI register.</p>}
              {(def.accounts || def.people) && <p className="mt-3 text-[13px] text-[#5e6b7b]">{def.people ? 'It also brings your staff list, with start and leaving dates, into the People page.' : 'It also lists who has an account, for access reviews and to catch leavers who still have access.'}</p>}
            </section>
          )}

          {canManage && editing && (
            <section className="rounded-xl border border-[#dde2e8] p-4">
              <h3 className="text-[15px] font-semibold text-[#0e1b2c]">{connected ? 'Replace the credential' : 'Connect it'}</h3>
              {blocked ? (
                <p className="mt-1 text-[13.5px] text-[#5e6b7b]">Connect Microsoft 365 first, at the top of this page. {def.name} reuses that connection.</p>
              ) : (
                <>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-[#2b3a4d]">{def.setup.map((s) => <li key={s}>{s}</li>)}</ol>
                  <a href={def.docs} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#8a6a1f] hover:underline">{def.name} documentation <ExternalLink className="h-3.5 w-3.5" /></a>
                  <div className="mt-4 space-y-3">
                    {def.fields.map((f) => (
                      <label key={f.key} className="block text-[13px] font-medium text-[#0e1b2c]">
                        {f.label}{f.optional && <span className="font-normal text-[#8a95a3]"> (optional)</span>}
                        {f.kind === 'select' ? (
                          <select value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]">
                            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : f.kind === 'textarea' ? (
                          <textarea value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} rows={4} placeholder={f.placeholder} spellCheck={false} className="mt-1 w-full rounded-xl border border-[#dde2e8] px-3 py-2 font-mono text-[12.5px] font-normal outline-none focus:border-[#a8772a]" />
                        ) : (
                          <input type={f.kind === 'secret' ? 'password' : 'text'} autoComplete="off" spellCheck={false} value={values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.placeholder} className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
                        )}
                        {f.help && <span className="mt-1 block text-[12.5px] font-normal text-[#8a95a3]">{f.help}</span>}
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-[12.5px] text-[#8a95a3]">AIC tries the credential before saving it, then stores it encrypted. You can disconnect at any time, which deletes it.</p>
                </>
              )}
            </section>
          )}
        </div>
        {err && <p role="alert" className="border-t border-[#b23a35]/20 bg-[#b23a35]/[0.05] px-5 py-3 text-[13px] text-[#8f2d29]">{err}</p>}
        {canManage && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f5] px-5 py-4">
            {editing ? (
              <button type="button" onClick={connect} disabled={busy || blocked || missing.length > 0} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">
                {busy ? 'Trying the credential…' : connected ? 'Save and check again' : `Connect ${def.name}`}
              </button>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-11 items-center rounded-full border border-[#dde2e8] px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]">Replace the credential</button>
            )}
            {connected && <button type="button" onClick={disconnect} disabled={busy} className="h-11 px-3 text-sm font-medium text-[#b23a35] hover:underline">Disconnect</button>}
            {!editing || !connected ? null : <button type="button" onClick={() => setEditing(false)} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>}
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
}

export function ConnectorCatalogue({ integrations, checks, canManage, onChanged, proven = [] }: { integrations: Integration[]; checks: Check[]; canManage: boolean; onChanged: (msg: string) => void; proven?: string[] }) {
  // A connector that has read a real account somewhere is no longer new.
  const CONNECTORS = useMemo(() => ALL_CONNECTORS.map((c) => (proven.includes(c.key) ? { ...c, verified: true } : c)), [proven]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ConnectorCategory | 'all' | 'connected'>('all');
  const [open, setOpen] = useState<ConnectorDef | null>(null);
  const byKey = useMemo(() => new Map(integrations.map((i) => [i.provider, i])), [integrations]);
  const cats = [...new Set(CONNECTORS.map((c) => c.category))];
  const connectedCount = CONNECTORS.filter((c) => byKey.get(c.key) && byKey.get(c.key)!.status !== 'disconnected').length;
  const shown = CONNECTORS.filter((c) => (cat === 'all' || (cat === 'connected' ? !!byKey.get(c.key) : c.category === cat)) && (!q || `${c.name} ${c.reads} ${CATEGORY_LABEL[c.category]}`.toLowerCase().includes(q.toLowerCase())));
  const microsoftConnected = !!integrations.find((i) => i.provider === 'microsoft' && i.status !== 'disconnected');

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold text-[#0e1b2c]">More systems</h2>
          <p className="mt-0.5 text-[14px] text-[#5e6b7b]">{CONNECTORS.length} more systems AIC can read with a read-only credential{connectedCount ? `, ${connectedCount} connected` : ''}.</p>
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a95a3]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search systems" aria-label="Search systems" className="h-10 w-full rounded-full border border-[#dde2e8] bg-white pl-9 pr-4 text-[14px] outline-none focus:border-[#a8772a]" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setCat('all')} className={chip(cat === 'all')}>All</button>
        {connectedCount > 0 && <button type="button" onClick={() => setCat('connected')} className={chip(cat === 'connected')}>Connected</button>}
        {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={chip(cat === c)}>{CATEGORY_LABEL[c]}</button>)}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const i = byKey.get(c.key);
          const st = state(i);
          const failing = i ? checks.filter((k) => k.provider === c.key && k.status === 'fail').length : 0;
          return (
            <li key={c.key}>
              <button type="button" onClick={() => setOpen(c)} className="flex h-full w-full flex-col rounded-2xl border border-[#dde2e8] bg-white p-4 text-left hover:border-[#a8772a]/60">
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-3">
                    <VendorLogo id={c.key} name={c.name} size={36} />
                    <span className="text-[15px] font-semibold text-[#0e1b2c]">{c.name}</span>
                  </span>
                  {st ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${st.tone}`}>{st.label}</span>
                    : !c.verified ? <span className="shrink-0 rounded-full bg-[#eef1f5] px-2 py-0.5 text-[12px] font-medium text-[#5e6b7b]">New</span> : null}
                </span>
                <span className="mt-2 text-[12.5px] text-[#8a95a3]">{CATEGORY_LABEL[c.category]}{c.people ? ', brings in your staff list' : c.accounts ? ', lists accounts' : ''}</span>
                <span className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-[#5e6b7b]">{c.reads}</span>
                {c.ai && c.category !== 'ai' && <span className="mt-2 text-[13px] text-[#8a6114]">Also records {c.ai.products.map((p) => AI_PRODUCTS[p].name).join(' and ')} use</span>}
                {i && failing > 0 && <span className="mt-2 text-[13px] font-medium text-[#b23a35]">{failing} check{failing === 1 ? '' : 's'} failing</span>}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="text-[14px] text-[#5e6b7b]">Nothing matches. AIC adds systems as clients ask for them; tell your AIC contact which one you need.</li>}
      </ul>
      {open && (
        <Drawer def={open} i={byKey.get(open.key)} checks={checks.filter((k) => k.provider === open.key)} canManage={canManage} microsoftConnected={microsoftConnected}
          onClose={() => setOpen(null)} onDone={(m) => { setOpen(null); onChanged(m); }} />
      )}
    </section>
  );
}
