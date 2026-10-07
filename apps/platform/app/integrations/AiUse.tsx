'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Upload } from 'lucide-react';
import { VendorLogo } from '@/app/components/ui/VendorLogo';
import { AI_PRODUCTS, IMPORTABLE, type AiProduct } from '@/lib/ai-use/products';
import { ago, type Integration, type Check } from './useIntegrations';

/**
 * AI in use: the AI people use inside the tools the organisation already runs,
 * and the AI services in its cloud accounts, as each vendor reports it.
 *
 * API spend per model has its own page; this is the half that an API key
 * never shows: seats, assistants and coding tools. Each product says where
 * the figures came from, and whether anything on the AI register covers it.
 */

type Subject = { subject: string; displayName: string | null; lastActiveAt: string | null; activity: number; detail: string | null };
type Product = {
  product: AiProduct; name: string; vendor: string; via: string; subjectKind: 'person' | 'model'; unit: string;
  active: number; activity: number; lastActiveAt: string | null; sources: string[]; declaredAs: string | null; subjects: Subject[];
};

type AiUseSummary = { at?: string; readings?: number; products?: AiProduct[]; notes?: string[]; facts?: Record<string, number | string | null> | null };

const fmt = (n: number) => n.toLocaleString('en-ZA');
const dateOf = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No use recorded');

/** Under a connection: what AI use it last read, and what it could not. */
export function AiUseNotes({ i, checks }: { i: Integration; checks: Check[] }) {
  const s = i.settings.aiUse as AiUseSummary | undefined;
  if (!s) return null;
  const register = checks.filter((c) => c.checkKey === 'ai.tool_on_register');
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[13px] text-[#5e6b7b]">
        {s.readings ? `AI use read ${ago(s.at ?? null)}: ${(s.products ?? []).map((p) => AI_PRODUCTS[p]?.name ?? p).join(', ')}.` : `No AI use found when last read, ${ago(s.at ?? null)}.`}
        {typeof s.facts?.assignedSeats === 'number' ? ` ${s.facts.assignedSeats} seats assigned, ${s.facts.monthlyActive ?? 0} active this month.` : ''}
        {typeof s.facts?.seats === 'number' ? ` ${s.facts.seats} Copilot seats.` : ''}
      </p>
      {(s.notes ?? []).map((n) => <p key={n} className="text-[13px] text-[#8a4a10]">{n}</p>)}
      {register.filter((c) => c.status !== 'pass').map((c) => (
        <p key={c.id} className="text-[13px] text-[#8a4a10]">{c.summary} <Link href="/overview" className="font-medium text-[#8a6114] underline-offset-2 hover:underline">Declare it</Link></p>
      ))}
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);
  const people = p.subjectKind === 'person';
  const headline = people
    ? `${fmt(p.active)} ${p.active === 1 ? 'person' : 'people'} active`
    : `${fmt(p.active)} ${p.active === 1 ? 'model' : 'models'} in use`;
  const amount = p.unit && p.activity > 0 ? `${fmt(p.activity)} ${p.unit}` : null;
  return (
    <li className="py-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <VendorLogo id={p.product} name={p.name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold text-[#0e1b2c]">{p.name}</h3>
            <span className="text-[14px] text-[#0e1b2c]">{headline}{amount ? `, ${amount}` : ''}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-[#5e6b7b]">
            {p.vendor}. From {p.sources.includes('import') && p.sources.length === 1 ? 'your imported export' : p.via}. Last use {dateOf(p.lastActiveAt)}.
          </p>
          <p className={`mt-1 text-[13px] ${p.declaredAs ? 'text-[#2e7a57]' : 'text-[#8a4a10]'}`}>
            {p.declaredAs
              ? `On your AI register as "${p.declaredAs}".`
              : <>Not on your AI register yet. <Link href="/overview" className="font-medium text-[#8a6114] underline-offset-2 hover:underline">Declare it with an owner</Link></>}
          </p>
          {p.subjects.length > 0 && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-[13px] font-medium text-[#0e1b2c] hover:text-[#8a6114]">
              {open ? 'Hide' : people ? `See who (${p.subjects.length})` : `See models (${p.subjects.length})`}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
          {open && (
            <ul className="mt-1 divide-y divide-[#eef1f5] rounded-xl border border-[#dde2e8]">
              {p.subjects.map((s) => (
                <li key={s.subject} className="grid gap-0.5 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-[#0e1b2c]">{s.displayName && s.displayName !== s.subject ? `${s.displayName}, ` : ''}{s.subject}</span>
                    {s.detail && <span className="block truncate text-[12.5px] text-[#8a95a3]">{s.detail}</span>}
                  </span>
                  <span className="text-[13px] text-[#5e6b7b] sm:text-right">
                    {p.unit && s.activity > 0 ? `${fmt(s.activity)} ${p.unit}, ` : ''}{s.lastActiveAt ? `last ${dateOf(s.lastActiveAt)}` : 'no use recorded'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function ImportPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [product, setProduct] = useState<AiProduct>(IMPORTABLE[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);

  async function send() {
    const f = file.current?.files?.[0];
    if (!f) { setErr('Choose the CSV file first.'); return; }
    if (f.size > 5_000_000) { setErr('That file is larger than 5 MB. Export a shorter period.'); return; }
    setBusy(true); setErr('');
    const csv = await f.text();
    const r = await fetch('/api/integrations/ai-use/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product, csv }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'The file could not be imported.'); return; }
    if (file.current) file.current.value = '';
    onDone([j.message, ...(j.problems ?? [])].join(' '));
  }

  return (
    <div className="rounded-xl border border-[#dde2e8] p-4 space-y-3">
      <div>
        <h3 className="text-[15px] font-semibold text-[#0e1b2c]">Import an export</h3>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#5e6b7b]">
          For AI tools with no reporting API on your plan. In ChatGPT Enterprise or Edu, open Workspace settings, Analytics, and export Users. For Claude, use the user export from your admin console if your plan has one. AIC keeps each person’s email, name, message count and last active date, and nothing else from the file.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-[13px] font-medium text-[#0e1b2c]">
          The export is from
          <select value={product} onChange={(e) => setProduct(e.target.value as AiProduct)} className="mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]">
            {IMPORTABLE.map((p) => <option key={p} value={p}>{p === 'claude_seats' ? 'Claude (Team or Enterprise)' : AI_PRODUCTS[p].name}</option>)}
          </select>
        </label>
        <label className="block text-[13px] font-medium text-[#0e1b2c]">
          CSV file
          <input ref={file} type="file" accept=".csv,text/csv" className="mt-1 block w-full text-[14px] file:mr-3 file:h-11 file:rounded-full file:border file:border-[#dde2e8] file:bg-white file:px-4 file:text-[14px] file:font-medium file:text-[#0e1b2c]" />
        </label>
        <button type="button" onClick={send} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0e1b2c] px-5 text-[14px] font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">
          <Upload className="h-4 w-4" /> {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
      {err && <p role="alert" className="text-[13px] text-[#b23a35]">{err}</p>}
    </div>
  );
}

export function AiUseSection({ canManage, onNotice, refreshKey }: { canManage: boolean; onNotice: (m: string) => void; refreshKey: number }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/integrations/ai-use');
    if (r.ok) setProducts(((await r.json()) as { products: Product[] }).products);
    else setProducts([]);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const off = products?.filter((p) => !p.declaredAs).length ?? 0;

  return (
    <section className="bg-white border border-[#dde2e8] rounded-xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[62ch]">
          <h2 className="text-[18px] font-semibold text-[#0e1b2c]">AI in use</h2>
          <p className="mt-0.5 text-[14px] leading-relaxed text-[#5e6b7b]">
            The AI your people use inside the tools you already run, and the AI services in your cloud accounts, over the last 30 days. API spend per model is on <Link href="/spend" className="font-medium text-[#8a6114] underline-offset-2 hover:underline">AI spend</Link>.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setShowImport(!showImport)} className="inline-flex h-11 sm:h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-[#d5dbe2] px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">
            <Upload className="h-4 w-4" /> {showImport ? 'Close import' : 'Import an export'}
          </button>
        )}
      </div>

      {showImport && <div className="mt-4"><ImportPanel onDone={(m) => { setShowImport(false); onNotice(m); load(); }} /></div>}

      {products === null ? (
        <p className="mt-4 text-[14px] text-[#5e6b7b]">Loading…</p>
      ) : products.length === 0 ? (
        <div className="mt-4 rounded-xl bg-[#f5f7f9] px-4 py-3.5 text-[14px] leading-relaxed text-[#2b3a4d]">
          <p className="font-medium text-[#0e1b2c]">No AI use recorded yet.</p>
          <p className="mt-1 text-[#5e6b7b]">
            It appears here once a connection that reads it has run: Anthropic with an admin key (Claude Code), Claude Enterprise (Claude seats), Microsoft 365 (Copilot), GitHub (Copilot seats), Google Workspace (Gemini), AWS (Bedrock), Azure (Azure OpenAI) or Google Cloud (Vertex AI). For ChatGPT, import the users export from workspace analytics.
          </p>
        </div>
      ) : (
        <>
          {off > 0 && (
            <p className="mt-4 rounded-xl bg-[#a8772a]/[0.07] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#6f5418]">
              {off === 1 ? 'One AI product people use is' : `${off} AI products people use are`} not on your AI register. Each one needs a named owner, even if it makes no decisions about people.
            </p>
          )}
          <ul className="mt-2 divide-y divide-[#eef1f5]">
            {products.map((p) => <ProductRow key={p.product} p={p} />)}
          </ul>
        </>
      )}
    </section>
  );
}
