'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Plus, X, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';
import type { Coverage } from '@/lib/controls';
import { parseRequirementList, suggestControls } from '@/lib/frameworks/custom';

type Meta = {
  key: string; name: string; fullName: string; publisher: string; version: string; region: string; appliesTo: string; note: string;
  sources: string[]; group: string; requirementCount: number; coverage: Coverage;
};
type CustomReq = { id: string; title: string; controls: string[] };
type Custom = { id: string; key: string; name: string; description: string | null; requirements: CustomReq[]; coverage: Coverage };
type Data = {
  canManage: boolean; storeReady: boolean; chosen: boolean; selected: string[]; groups: Record<string, string>;
  catalogue: Meta[]; aic: Coverage; custom: Custom[];
  commonControls: { key: string; title: string; area: string }[]; areas: Record<string, string>;
};

const mappedOf = (c: Coverage) => c.total - c.notMapped;
const pct = (c: Coverage) => (mappedOf(c) ? Math.round((c.evidenced / mappedOf(c)) * 100) : 0);

function Bar({ c }: { c: Coverage }) {
  const m = mappedOf(c);
  return (
    <div className="h-1.5 rounded-full bg-[#eef1f5] overflow-hidden flex" aria-hidden>
      <div className="h-full bg-[#2e7a57]" style={{ width: `${m ? (c.evidenced / m) * 100 : 0}%` }} />
      <div className="h-full bg-[#a8772a]/60" style={{ width: `${m ? (c.partial / m) * 100 : 0}%` }} />
      <div className="h-full bg-[#b23a35]/70" style={{ width: `${m ? (c.gap / m) * 100 : 0}%` }} />
    </div>
  );
}

function CoverageLine({ c }: { c: Coverage }) {
  return (
    <p className="text-[12.5px] text-[#5e6b7b]">
      <span className="font-medium text-[#0e1b2c]">{c.evidenced}</span> of {mappedOf(c)} evidenced
      {c.gap > 0 && <span className="text-[#b23a35]">, {c.gap} with a gap</span>}
      {c.notMapped > 0 && <span>, {c.notMapped} not mapped</span>}
    </p>
  );
}

function FrameworkCard({ f, on, canManage, busy, onToggle }: { f: Meta; on: boolean; canManage: boolean; busy: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`rounded-xl border bg-white p-4 transition-colors ${on ? 'border-[#a8772a]/50' : 'border-[#dde2e8]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#0e1b2c]">{f.name}</p>
          <p className="mt-0.5 text-[12.5px] text-[#8a95a3]">{f.requirementCount} requirements, {f.region}</p>
        </div>
        {canManage ? (
          <button type="button" onClick={onToggle} disabled={busy} aria-pressed={on}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium disabled:opacity-50 ${on ? 'bg-[#0e1b2c] text-white' : 'border border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>
            {on ? <><Check className="h-4 w-4" />Tracking</> : <><Plus className="h-4 w-4" />Track</>}
          </button>
        ) : on && <span className="rounded-full bg-[#eef1f5] px-2.5 py-1 text-[12px] font-medium text-[#5e6b7b]">Tracking</span>}
      </div>
      <div className="mt-3 space-y-1.5">
        <Bar c={f.coverage} />
        <CoverageLine c={f.coverage} />
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#8a6a1f]">
        About this framework <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-[#5e6b7b]">
          <p><span className="font-medium text-[#0e1b2c]">{f.fullName}</span>. {f.publisher}. Version: {f.version}.</p>
          <p><span className="font-medium text-[#0e1b2c]">Applies to:</span> {f.appliesTo}</p>
          <p>{f.note}</p>
          {f.sources.length > 0 && (
            <ul className="space-y-0.5">
              {f.sources.slice(0, 4).map((s) => (
                <li key={s}><a href={s} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-[#8a6a1f] hover:underline underline-offset-2">{new URL(s).hostname}<ExternalLink className="h-3 w-3 shrink-0" /></a></li>
              ))}
            </ul>
          )}
          {on && <Link href={`/controls?fw=${f.key}`} className="inline-block font-medium text-[#0e1b2c] underline underline-offset-2">See each requirement</Link>}
        </div>
      )}
    </li>
  );
}

function CustomEditor({ initial, common, areas, onClose, onSaved }: {
  initial: Custom | null; common: Data['commonControls']; areas: Record<string, string>; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reqs, setReqs] = useState<CustomReq[]>(initial?.requirements.map(({ id, title, controls }) => ({ id, title, controls })) ?? []);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const title = useMemo(() => Object.fromEntries(common.map((c) => [c.key, c.title])), [common]);
  const grouped = useMemo(() => Object.entries(areas).map(([a, label]) => ({ label, items: common.filter((c) => c.area === a) })), [areas, common]);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState('');
  async function addFromPaste() {
    const parsed = parseRequirementList(paste);
    if (!parsed.length) return;
    const offset = reqs.length;
    const added = parsed.map((p, i) => ({ id: /^\d+$/.test(p.id) ? String(offset + i + 1) : p.id, title: p.title, controls: suggestControls(p.title) }));
    setReqs((cur) => [...cur, ...added]);
    setPaste('');
    // Ask AIC for a better first guess; keep the keyword guess if it cannot answer.
    setSuggesting(true); setSuggestNote('');
    try {
      const r = await fetch('/api/frameworks/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirements: added.map(({ id, title }) => ({ id, title })) }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.map) {
        const ids = new Set(added.map((a) => a.id));
        setReqs((cur) => cur.map((x) => (ids.has(x.id) && Array.isArray(j.map[x.id]) ? { ...x, controls: j.map[x.id] } : x)));
        setSuggestNote(j.source === 'ai' ? 'AIC read each requirement and suggested controls. Check every one before saving.' : 'Controls suggested from keywords. Check every one before saving.');
      }
    } finally { setSuggesting(false); }
  }
  const update = (i: number, r: Partial<CustomReq>) => setReqs(reqs.map((x, j) => (j === i ? { ...x, ...r } : x)));

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch(initial ? `/api/frameworks/custom/${initial.id}` : '/api/frameworks/custom', {
      method: initial ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, requirements: reqs }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onSaved();
  }

  return (
    <SectionCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[16px] font-semibold text-[#0e1b2c]">{initial ? `Edit ${initial.name}` : 'Add your own framework'}</h2>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5] text-[#0e1b2c]" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-[13px] leading-relaxed text-[#5e6b7b]">A customer&apos;s security schedule, an internal standard, a regulator&apos;s letter. Paste its requirements, one per line, and AIC suggests which common controls each one maps to. Check every suggestion: it is a first guess, not a judgement. Your own frameworks never appear on your public Trust page.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-medium text-[#0e1b2c]">Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Acme Bank supplier schedule" className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
        </label>
        <label className="block text-[13px] font-medium text-[#0e1b2c]">Description <span className="font-normal text-[#8a95a3]">(optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Where it comes from and who asked" className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]" />
        </label>
      </div>
      <div>
        <label className="block text-[13px] font-medium text-[#0e1b2c]" htmlFor="paste">Paste requirements</label>
        <textarea id="paste" value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
          placeholder={'4.1, Suppliers must enforce multi-factor authentication for all staff\n4.2, Backups are tested at least annually\n4.3, Security incidents are reported to Acme within 24 hours'}
          className="mt-1 w-full rounded-xl border border-[#dde2e8] bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none focus:border-[#a8772a]" />
        <button type="button" onClick={addFromPaste} disabled={!paste.trim() || suggesting} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-40"><Plus className="h-4 w-4" />Add these</button>
        {suggesting && <p className="mt-2 text-[13px] text-[#8a6a1f]">AIC is reading the requirements and suggesting controls…</p>}
        {!suggesting && suggestNote && <p className="mt-2 text-[13px] text-[#5e6b7b]">{suggestNote}</p>}
      </div>
      {reqs.length > 0 && (
        <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#dde2e8]">
          {reqs.map((r, i) => (
            <li key={i} className="space-y-2 p-3">
              <div className="flex items-start gap-2">
                <input value={r.id} onChange={(e) => update(i, { id: e.target.value })} maxLength={40} aria-label="Reference" className="h-9 w-20 shrink-0 rounded-lg border border-[#dde2e8] px-2 text-[13px] font-semibold tabular-nums outline-none focus:border-[#a8772a]" />
                <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} aria-label="Requirement" className="h-9 min-w-0 flex-1 rounded-lg border border-[#dde2e8] px-2 text-[13.5px] outline-none focus:border-[#a8772a]" />
                <button type="button" onClick={() => setReqs(reqs.filter((_, j) => j !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8a95a3] hover:text-[#b23a35]" aria-label={`Remove ${r.id}`}><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:pl-[88px]">
                {r.controls.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-[#a8772a]/10 py-1 pl-2.5 pr-1 text-[12px] font-medium text-[#6f5418]">
                    {title[k] ?? k}
                    <button type="button" onClick={() => update(i, { controls: r.controls.filter((x) => x !== k) })} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#a8772a]/20" aria-label={`Unmap ${title[k]}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                {r.controls.length === 0 && <span className="text-[12px] text-[#8a95a3]">Not mapped</span>}
                {r.controls.length < 6 && (
                  <select value="" onChange={(e) => e.target.value && update(i, { controls: [...r.controls, e.target.value] })} aria-label="Map to a control"
                    className="h-8 rounded-full border border-dashed border-[#c9ced6] bg-white px-2 text-[12px] text-[#5e6b7b] outline-none">
                    <option value="">+ Map to a control</option>
                    {grouped.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.filter((c) => !r.controls.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !name.trim() || reqs.length === 0} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Saving…' : initial ? 'Save changes' : 'Add framework'}</button>
        <span className="text-[13px] text-[#5e6b7b]">{reqs.length} requirement{reqs.length === 1 ? '' : 's'}, {reqs.filter((r) => r.controls.length).length} mapped</span>
        {err && <span className="text-[13px] text-[#b23a35]">{err}</span>}
      </div>
    </SectionCard>
  );
}

export default function FrameworksPage() {
  const [d, setD] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<Custom | 'new' | null>(null);

  const load = useCallback(() => {
    fetch('/api/frameworks', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  async function toggle(key: string) {
    if (!d) return;
    const next = d.selected.includes(key) ? d.selected.filter((k) => k !== key) : [...d.selected, key];
    setBusy(true); setMsg('');
    setD({ ...d, selected: next });
    const r = await fetch('/api/frameworks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected: next }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? 'Could not save.'); load(); return; }
    setD((x) => (x ? { ...x, selected: next, chosen: true } : x));
  }

  async function remove(c: Custom) {
    if (!window.confirm(`Remove ${c.name}? Evidence you filed stays; it belongs to the common controls.`)) return;
    const r = await fetch(`/api/frameworks/custom/${c.id}`, { method: 'DELETE' });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error ?? 'Could not remove it.'); return; }
    load();
  }

  const tracked = d ? d.catalogue.filter((f) => d.selected.includes(f.key)) : [];
  const groups = d ? Object.entries(d.groups).map(([g, label]) => ({ g, label, items: d.catalogue.filter((f) => f.group === g) })).filter((x) => x.items.length) : [];

  return (
    <DashboardShell>
      <div className="">
        <PageHeader
          eyebrow="Compliance tracking"
          title="Frameworks"
          lede="Choose the frameworks you answer to. AIC maps each one to the same common controls, so evidence you file once counts everywhere it applies. Coverage shows what your evidence speaks to; an auditor or certification body decides whether you meet a framework."
        />
        {failed && <p className="text-sm text-[#b42318]">Could not load frameworks. Try refreshing.</p>}
        {!d && !failed && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
        {d && (
          <div className="space-y-8">
            {!d.storeReady && (
              <div className="rounded-xl border border-[#b45309]/30 bg-[#b45309]/[0.06] p-4 text-[13.5px] text-[#0e1b2c]">
                Choosing frameworks is not switched on for this AIC server yet, so you see the default set and changes cannot be saved. AIC has been told.
              </div>
            )}
            {msg && <p className="text-[13px] text-[#b23a35]">{msg}</p>}

            <section>
              <h2 className="mb-3 text-[18px] font-semibold text-[#0e1b2c]">You track {tracked.length + d.custom.length + 1}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <li>
                  <Link href="/controls" className="block h-full rounded-xl border border-[#0e1b2c]/15 bg-[#0e1b2c] p-4 text-white">
                    <p className="text-[15px] font-semibold">AIC standard</p>
                    <p className="mt-0.5 text-[12.5px] text-white/60">Always tracked</p>
                    <p className="mt-3 font-serif text-[26px] font-semibold">{d.aic.total ? `${pct(d.aic)}%` : '—'}</p>
                    <p className="text-[12.5px] text-white/70">{d.aic.total ? `${d.aic.evidenced} of ${d.aic.total} requirements evidenced` : 'Load your requirements in the Evidence Vault'}</p>
                  </Link>
                </li>
                {[...tracked.map((f) => ({ key: f.key, name: f.name, sub: f.region, c: f.coverage })), ...d.custom.map((c) => ({ key: c.key, name: c.name, sub: 'Your own', c: c.coverage }))].map((f) => (
                  <li key={f.key}>
                    <Link href={`/controls?fw=${encodeURIComponent(f.key)}`} className="block h-full rounded-xl border border-[#dde2e8] bg-white p-4 hover:border-[#a8772a]">
                      <p className="truncate text-[15px] font-semibold text-[#0e1b2c]">{f.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-[#8a95a3]">{f.sub}</p>
                      <p className="mt-3 font-serif text-[26px] font-semibold text-[#0e1b2c]">{pct(f.c)}%</p>
                      <div className="mt-1 space-y-1.5"><Bar c={f.c} /><CoverageLine c={f.c} /></div>
                    </Link>
                  </li>
                ))}
              </ul>
              {!d.chosen && d.storeReady && <p className="mt-3 text-[13px] text-[#5e6b7b]">These are the defaults. Track or stop tracking any framework below and AIC remembers your choice.</p>}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#0e1b2c]">Your own frameworks</h2>
                  <p className="mt-0.5 text-[13px] text-[#5e6b7b]">For anything not in the catalogue: a customer&apos;s schedule, an internal standard.</p>
                </div>
                {d.canManage && d.storeReady && editing === null && (
                  <button type="button" onClick={() => setEditing('new')} className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" />Add a framework</button>
                )}
              </div>
              {editing && (
                <CustomEditor key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} common={d.commonControls} areas={d.areas}
                  onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
              )}
              {d.custom.length > 0 ? (
                <ul className="divide-y divide-[#eef1f5] rounded-xl border border-[#dde2e8] bg-white">
                  {d.custom.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-[#0e1b2c]">{c.name}</p>
                        <p className="text-[12.5px] text-[#5e6b7b]">{c.requirements.length} requirements{c.description ? `. ${c.description}` : ''}</p>
                      </div>
                      {d.canManage && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => setEditing(c)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#5e6b7b] hover:bg-[#eef1f5]" aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                          <button type="button" onClick={() => remove(c)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#5e6b7b] hover:bg-[#eef1f5] hover:text-[#b23a35]" aria-label={`Remove ${c.name}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : !editing && <p className="text-[13px] text-[#8a95a3]">None yet.</p>}
            </section>

            {groups.map((g, gi) => (
              <section key={g.g} data-tour={gi === 0 ? 'setup-frameworks' : undefined}>
                <h2 className="mb-3 text-[18px] font-semibold text-[#0e1b2c]">{g.label}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((f) => (
                    <FrameworkCard key={f.key} f={f} on={d.selected.includes(f.key)} canManage={d.canManage && d.storeReady} busy={busy} onToggle={() => toggle(f.key)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
