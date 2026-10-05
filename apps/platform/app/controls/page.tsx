'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, Upload, Library } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '../components/ui/PageHeader';
import type { EvaluatedControl, EvaluatedCommonControl, ControlStatus, FrameworkMeta } from '@/lib/controls';
import { AREA_LABEL, controlSlot, type CommonArea } from '@/lib/common-controls';
import { TriageNote } from '../components/ui/TriageNote';
import type { Triage } from '@/lib/ai/triage-shared';

/**
 * Requirements by framework, each with the evidence on the platform that
 * speaks to it, and the common controls underneath them where evidence is
 * actually filed. A summary of evidence, not a conformity decision.
 */

const STATUS: Record<ControlStatus, { label: string; dot: string }> = {
  gap: { label: 'Gap', dot: 'bg-[#b23a35]' },
  partial: { label: 'Partly evidenced', dot: 'bg-[#a8772a]' },
  no_evidence: { label: 'No evidence yet', dot: 'bg-[#c9ced6]' },
  evidenced: { label: 'Evidenced', dot: 'bg-[#2e7a57]' },
  not_mapped: { label: 'Not mapped: AIC holds nothing that speaks to this', dot: 'bg-white border border-[#c9ced6]' },
};
const SRC: Record<string, string> = { pass: 'text-[#2e7a57]', fail: 'text-[#b23a35]', pending: 'text-[#8a6a1f]', none: 'text-[#8a95a3]' };
const SRC_LABEL: Record<string, string> = { pass: 'Passing', fail: 'Failing', pending: 'In progress', none: 'Nothing yet' };
const ORDER: ControlStatus[] = ['gap', 'partial', 'no_evidence', 'evidenced', 'not_mapped'];
const COMMON = '__common';

type Data = { frameworks: FrameworkMeta[]; controls: EvaluatedControl[]; common: EvaluatedCommonControl[]; canUpload: boolean };

function Summary({ items }: { items: { status: ControlStatus }[] }) {
  const mapped = items.filter((c) => c.status !== 'not_mapped');
  const evidenced = mapped.filter((c) => c.status === 'evidenced').length;
  const gaps = mapped.filter((c) => c.status === 'gap').length;
  const notMapped = items.length - mapped.length;
  return (
    <div>
      <p className="text-[15px] text-[#0e1b2c]">
        <span className="font-semibold">{evidenced} of {mapped.length}</span> evidenced{gaps > 0 ? <>, <span className="text-[#b23a35]">{gaps} with a gap</span></> : null}
        {notMapped > 0 && <span className="text-[#5e6b7b]">. {notMapped} not mapped</span>}.
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-[#eef1f5] overflow-hidden max-w-[420px]" aria-hidden>
        <div className="h-full bg-[#a8772a] transition-[width] duration-500" style={{ width: `${mapped.length ? (evidenced / mapped.length) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: EvaluatedControl['sources'] }) {
  return (
    <ul className="space-y-1.5">
      {sources.map((s, i) => (
        <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 text-[13.5px]">
          <Link href={s.href} className="flex-1 text-[#0e1b2c] hover:text-[#8a6a1f] underline decoration-[#d5dbe2] underline-offset-2">{s.label}</Link>
          <span className={SRC[s.status]}>{SRC_LABEL[s.status]}</span>
        </li>
      ))}
    </ul>
  );
}

function UploadButton({ controlKey, onDone }: { controlKey: string; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [triage, setTriage] = useState<Triage | null>(null);
  async function send(file: File) {
    setBusy(true); setMsg(null); setTriage(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slotType', controlSlot(controlKey));
    const r = await fetch('/api/v1/vault/upload', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? 'The file could not be filed.' }); return; }
    setMsg({ ok: true, text: `${file.name} filed. An AIC assessor will review it.` });
    setTriage(j.triage ?? null);
    onDone();
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={ref} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) send(f); e.target.value = ''; }} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50">
        <Upload className="h-4 w-4" />{busy ? 'Filing and reading…' : 'File a document'}
      </button>
      {msg && <span className={`text-[13px] ${msg.ok ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>{msg.text}</span>}
      {triage && <div className="w-full"><TriageNote triage={triage} /></div>}
    </div>
  );
}

function ControlsInner() {
  const params = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [fw, setFw] = useState<string>(params.get('view') === 'common' ? COMMON : params.get('fw') ?? 'aic');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/controls', { cache: 'no-store' })
      .then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); setData(b); })
      .catch((e) => setError(e.message || 'Could not load controls.'));
  }, []);
  useEffect(load, [load]);

  // A link to /controls?view=common#iam.mfa opens that control.
  useEffect(() => {
    if (!data || fw !== COMMON) return;
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (h && data.common.some((c) => c.key === h)) {
      setOpen(`cc:${h}`);
      requestAnimationFrame(() => document.getElementById(`cc-${h}`)?.scrollIntoView({ block: 'center' }));
    }
  }, [data, fw]);

  useEffect(() => {
    if (data && fw !== COMMON && !data.frameworks.some((f) => f.key === fw)) setFw('aic');
  }, [data, fw]);

  const shown = useMemo(() => (data?.controls ?? []).filter((c) => c.framework === fw), [data, fw]);
  const sorted = useMemo(() => (fw === 'aic' ? shown : [...shown].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))), [shown, fw]);
  const framework = data?.frameworks.find((f) => f.key === fw);
  const tabs = useMemo(() => {
    if (!data) return [];
    const pct = (items: { status: ControlStatus }[]) => {
      const mapped = items.filter((c) => c.status !== 'not_mapped');
      return mapped.length ? Math.round((mapped.filter((c) => c.status === 'evidenced').length / mapped.length) * 100) : null;
    };
    return [
      ...data.frameworks.map((f) => ({ key: f.key, name: f.name, pct: pct(data.controls.filter((c) => c.framework === f.key)) })),
      { key: COMMON, name: 'Common controls', pct: pct(data.common) },
    ];
  }, [data]);

  /** How many tracked requirements lean on each common control. */
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data?.controls ?? []) for (const k of c.controls ?? []) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, [data]);

  const byArea = useMemo(() => {
    const m = new Map<CommonArea, EvaluatedCommonControl[]>();
    for (const c of data?.common ?? []) m.set(c.area, [...(m.get(c.area) ?? []), c]);
    return [...m];
  }, [data]);

  const pick = (k: string) => {
    setFw(k); setOpen(null);
    const u = new URL(window.location.href);
    u.search = k === COMMON ? '?view=common' : k === 'aic' ? '' : `?fw=${encodeURIComponent(k)}`;
    u.hash = '';
    window.history.replaceState(null, '', u);
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Compliance tracking"
          title="Controls"
          lede="Each requirement of the frameworks you track, and what on the platform is evidence for it. Evidence is filed once, against a common control, and counts for every framework that asks for it. Evidenced is not the same as certified; only an assessment decides that."
          actions={<Link href="/frameworks" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Library className="h-4 w-4" />Choose frameworks</Link>}
        />
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
        {!data && !error && <p className="text-[14px] text-[#5e6b7b]">Loading…</p>}
        {data && (
          <>
            <div className="xl:grid xl:grid-cols-[264px_minmax(0,1fr)] xl:gap-8">
            {/* Wide screens: frameworks as a list with each one's coverage. Narrow: a row of tabs. */}
            <nav aria-label="Frameworks" className="hidden xl:block">
              <div className="sticky top-24 space-y-1">
                {tabs.map((f) => {
                  const on = fw === f.key;
                  return (
                    <button key={f.key} onClick={() => pick(f.key)} aria-current={on ? 'page' : undefined}
                      className={`w-full rounded-xl px-3.5 py-2.5 text-left transition-colors ${on ? 'bg-white shadow-[0_1px_0_rgba(10,23,40,0.04)] ring-1 ring-[#dde2e8]' : 'hover:bg-white/70'}`}>
                      <span className={`block text-[14px] ${on ? 'font-semibold text-[#0e1b2c]' : 'font-medium text-[#33404f]'}`}>{f.name}</span>
                      {f.pct !== null && (
                        <span className="mt-1.5 flex items-center gap-2">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#e6e9ee]"><span className="block h-full rounded-full bg-[#a8772a]" style={{ width: `${f.pct}%` }} /></span>
                          <span className="w-9 text-right text-[12px] tabular-nums text-[#8a95a3]">{f.pct}%</span>
                        </span>
                      )}
                    </button>
                  );
                })}
                <Link href="/frameworks" className="mt-2 block px-3.5 py-2 text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">Choose frameworks</Link>
              </div>
            </nav>
            <div className="min-w-0 space-y-6">
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0 pb-1 xl:hidden">
              {tabs.map((f) => (
                <button key={f.key} onClick={() => pick(f.key)} className={`h-10 sm:h-9 px-4 rounded-full text-[14px] font-medium whitespace-nowrap border ${fw === f.key ? 'bg-[#0e1b2c] text-white border-[#0e1b2c]' : 'bg-white text-[#5e6b7b] border-[#dde2e8]'}`}>
                  {f.name}
                </button>
              ))}
            </div>

            {fw === COMMON ? (
              <>
                <div>
                  <Summary items={data.common} />
                  <p className="mt-2 text-[13px] text-[#5e6b7b] max-w-2xl">
                    The things your organisation does once that many frameworks ask about in their own words. Checks from connected systems and your policies count automatically; for the rest, file a document and an AIC assessor reviews it.
                  </p>
                </div>
                {byArea.map(([area, list]) => (
                  <section key={area}>
                    <h2 className="mb-2 text-[15px] font-semibold text-[#0e1b2c]">{AREA_LABEL[area]}</h2>
                    <div className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden">
                      {list.map((c) => {
                        const k = `cc:${c.key}`;
                        const isOpen = open === k;
                        const n = usage.get(c.key) ?? 0;
                        return (
                          <div key={c.key} id={`cc-${c.key}`}>
                            <button onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen} className="w-full text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-[#fafbfc]">
                              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS[c.status].dot}`} aria-hidden />
                              <span className="flex-1 min-w-0">
                                <span className="block text-[14.5px] font-medium text-[#0e1b2c]">{c.title}</span>
                                <span className="block text-[13px] text-[#5e6b7b] mt-0.5">{STATUS[c.status].label}{n > 0 ? `, used by ${n} requirement${n === 1 ? '' : 's'} in your frameworks` : ''}</span>
                              </span>
                              <ChevronDown className={`w-4 h-4 mt-1 text-[#8a95a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpen && (
                              <div className="px-4 sm:px-5 pb-4 sm:pl-[44px] space-y-3">
                                <p className="text-[13px] text-[#5e6b7b]"><span className="font-medium text-[#0e1b2c]">Good evidence:</span> {c.evidence}</p>
                                <Sources sources={c.sources} />
                                {data.canUpload && <UploadButton controlKey={c.key} onDone={load} />}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            ) : (
              <>
                {shown.length > 0 && (
                  <div>
                    <Summary items={shown} />
                    <p className="mt-2 text-[13px] text-[#5e6b7b] max-w-2xl">{framework?.note}</p>
                  </div>
                )}
                {shown.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-[14px] text-[#5e6b7b]">
                    {fw === 'aic' ? <>No requirements are loaded yet. <Link href="/evidence" className="text-[#8a6a1f] hover:underline">Load them in the Evidence Vault</Link>.</> : 'Nothing to show.'}
                  </div>
                )}
                {shown.length > 0 && (
                  <section className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden">
                    {sorted.map((c) => {
                      const k = `${c.framework}:${c.id}`;
                      const isOpen = open === k;
                      const mapped = c.status !== 'not_mapped';
                      return (
                        <div key={k}>
                          <button onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen} className="w-full text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-[#fafbfc]">
                            <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS[c.status].dot}`} aria-hidden />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[14.5px] text-[#0e1b2c]"><span className="font-semibold tabular-nums">{c.id}</span> {c.title}</span>
                              <span className="block text-[13px] text-[#5e6b7b] mt-0.5">{STATUS[c.status].label}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 mt-1 text-[#8a95a3] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {isOpen && (
                            <div className="px-4 sm:px-5 pb-4 sm:pl-[44px]">
                              {mapped ? (
                                <>
                                  {fw !== 'aic' && <p className="mb-2 text-[12.5px] text-[#8a95a3]">Common controls that usually support this requirement:</p>}
                                  <Sources sources={c.sources} />
                                </>
                              ) : (
                                <p className="text-[13.5px] text-[#5e6b7b]">AIC does not map this requirement to anything it can see. Keep your own evidence for it; an auditor will ask.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
              </>
            )}
            </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function ControlsPage() {
  return <Suspense fallback={null}><ControlsInner /></Suspense>;
}
