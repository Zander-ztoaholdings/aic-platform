'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';
import { TrustView } from '@/app/components/TrustView';
import type { TrustView as View, SectionKey, Sections } from '@/lib/trust';

type Data = {
  canManage: boolean;
  page: { enabled: boolean; slug: string; intro: string; contactEmail: string; sections: Sections; exists: boolean };
  sectionKeys: SectionKey[];
  sectionLabels: Record<SectionKey, { title: string; help: string }>;
  preview: View;
};

const field = 'w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-sm text-[#0e1b2c] outline-none focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15';

export default function TrustSettingsPage() {
  const [d, setD] = useState<Data | null>(null);
  const [form, setForm] = useState<Data['page'] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch('/api/trust', { cache: 'no-store' }).then((r) => r.json()).then((x: Data) => { setD(x); setForm(x.page); setDirty(false); });
  }, []);
  useEffect(load, [load]);

  const edit = (patch: Partial<Data['page']>) => { if (form) { setForm({ ...form, ...patch }); setDirty(true); } };

  async function save(enabled?: boolean) {
    if (!form) return;
    setBusy(true); setMsg(null);
    const body = { ...form, enabled: enabled ?? form.enabled };
    const r = await fetch('/api/trust', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error ?? 'Could not save.' }); return; }
    setMsg({ ok: true, text: body.enabled ? 'Saved. Your Trust page is live.' : 'Saved. Your Trust page is not published.' });
    load();
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <DashboardShell>
      <div className="max-w-6xl">
        <PageHeader
          eyebrow="AIC Certification"
          title="Trust page"
          lede="A public page you send to customers and buyers instead of answering the same questions again. You choose what it shows, and each item says whether AIC issued it, AIC observed it, or you declared it."
          actions={d?.page.enabled && d.page.exists ? (
            <a href={`/trust/${d.page.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a]">
              Open live page <ExternalLink className="h-4 w-4" />
            </a>
          ) : undefined}
        />

        {!d || !form ? <p className="text-sm text-[#5e6b7b]">Loading…</p> : (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
            <div className="space-y-4">
              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0e1b2c]">{d.page.enabled ? 'Live' : 'Not published'}</div>
                    <div className="text-[13px] text-[#5e6b7b]">{d.page.enabled ? 'Anyone with the link can see it.' : 'Only your team can see the preview.'}</div>
                  </div>
                  {d.canManage && (
                    <button onClick={() => save(!d.page.enabled)} disabled={busy} className={`inline-flex h-11 shrink-0 items-center rounded-full px-5 text-sm font-medium ${d.page.enabled ? 'border border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]' : 'bg-[#0e1b2c] text-white hover:bg-[#22344a]'}`}>
                      {d.page.enabled ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                </div>
                {d.page.enabled && <p className="mt-3 break-all text-[12px] text-[#8a95a3]">{origin}/trust/{d.page.slug}</p>}
                {msg && <p className={`mt-3 text-[13px] ${msg.ok ? 'text-[#2f7d4f]' : 'text-[#b42318]'}`}>{msg.text}</p>}
              </SectionCard>

              <SectionCard>
                <label className="block text-[13px] font-medium text-[#5e6b7b]" htmlFor="tp-slug">Address</label>
                <div className="mt-1.5 flex h-11 items-center rounded-xl border border-[#dde2e8] bg-white px-3.5 focus-within:border-[#a8772a]">
                  <span className="shrink-0 text-[13px] text-[#8a95a3]">/trust/</span>
                  <input id="tp-slug" disabled={!d.canManage} value={form.slug} onChange={(e) => edit({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="ml-0.5 w-full bg-transparent text-sm text-[#0e1b2c] outline-none" />
                </div>

                <label className="mt-4 block text-[13px] font-medium text-[#5e6b7b]" htmlFor="tp-intro">Introduction <span className="font-normal text-[#8a95a3]">(optional)</span></label>
                <textarea id="tp-intro" disabled={!d.canManage} value={form.intro} onChange={(e) => edit({ intro: e.target.value })} rows={4} maxLength={1200} placeholder="A sentence or two on how you use AI, and who to talk to." className={`${field} mt-1.5 py-3`} />

                <label className="mt-4 block text-[13px] font-medium text-[#5e6b7b]" htmlFor="tp-email">Contact email <span className="font-normal text-[#8a95a3]">(optional)</span></label>
                <input id="tp-email" disabled={!d.canManage} value={form.contactEmail} onChange={(e) => edit({ contactEmail: e.target.value })} placeholder="trust@yourcompany.co.za" className={`${field} mt-1.5 h-11`} />
              </SectionCard>

              <SectionCard>
                <div className="text-sm font-semibold text-[#0e1b2c]">What the page shows</div>
                <ul className="mt-3 space-y-3">
                  {d.sectionKeys.map((k) => (
                    <li key={k} className="flex items-start gap-3">
                      <button
                        type="button" role="switch" aria-checked={form.sections[k]} aria-label={d.sectionLabels[k].title} disabled={!d.canManage}
                        onClick={() => edit({ sections: { ...form.sections, [k]: !form.sections[k] } })}
                        className={`mt-0.5 relative h-6 w-10 shrink-0 rounded-full transition-colors ${form.sections[k] ? 'bg-[#0e1b2c]' : 'bg-[#d4dae1]'}`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${form.sections[k] ? 'left-[18px]' : 'left-0.5'}`} />
                      </button>
                      <span>
                        <span className="block text-sm text-[#0e1b2c]">{d.sectionLabels[k].title}</span>
                        <span className="block text-[12px] leading-snug text-[#5e6b7b]">{d.sectionLabels[k].help}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              {d.canManage && (
                <button onClick={() => save()} disabled={busy || !dirty} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0e1b2c] text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Save changes</button>
              )}
            </div>

            <div>
              <div className="mb-2 text-[13px] text-[#5e6b7b]">Preview of the saved page{dirty ? ' (save to update it)' : ''}</div>
              <div className="rounded-2xl border border-dashed border-[#c5cdd6] bg-[#f5f7f9] p-4 sm:p-6">
                <div className="mb-1 text-[13px] font-medium text-[#8a6a1f]">How this organisation governs its AI</div>
                <div className="mb-5 font-serif text-[26px] font-semibold text-[#0e1b2c]">{d.preview.name}</div>
                <TrustView v={d.preview} />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
