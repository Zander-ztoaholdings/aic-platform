'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow } from '../components/ui/Eyebrow';

/**
 * Policies: what the organisation has adopted, which version is in force,
 * and how many people have accepted it. Templates are starting points; a
 * policy is only published once its square-bracketed parts are filled in.
 */

type Policy = { id: string; title: string; publishedVersion: number; reviewDueAt: string | null; accepted: number; acceptedByMe: boolean; controls: string[] };
type Template = { key: string; title: string; summary: string; controls: string[] };
type Data = { canManage: boolean; members: number; policies: Policy[]; templates: Template[] };

export default function PoliciesPage() {
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/policies', { cache: 'no-store' });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setError(b.error || 'Could not load policies.'); return; }
    setD(b);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function adopt(key: string) {
    setBusy(key);
    const r = await fetch('/api/policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateKey: key }) });
    const b = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setError(b.error || 'Could not adopt the template.'); return; }
    router.push(`/policies/${b.id}?edit=1`);
  }

  return (
    <DashboardShell>
      <div className="max-w-[920px] space-y-7">
        <header>
          <Eyebrow>Compliance tracking</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Policies</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            The rules your organisation has set for itself, which version is in force, and who has read and accepted it.
          </p>
        </header>
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
        {!d && !error && <p className="text-[14px] text-[#5e6b7b]">Loading…</p>}

        {d && (
          <>
            {d.policies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-[14px] text-[#5e6b7b]">
                No policies yet. {d.canManage ? 'Start from one of the templates below.' : 'An organisation admin can adopt them.'}
              </div>
            ) : (
              <section className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
                {d.policies.map((p) => {
                  const due = p.reviewDueAt && new Date(p.reviewDueAt).getTime() < Date.now();
                  return (
                    <Link key={p.id} href={`/policies/${p.id}`} className="block px-4 sm:px-5 py-4 hover:bg-[#fafbfc]">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                        <span className="flex-1 text-[15px] font-semibold text-[#0e1b2c]">{p.title}</span>
                        {p.publishedVersion === 0 ? (
                          <span className="self-start text-[12px] font-medium px-2 py-0.5 rounded-full text-[#5e6b7b] bg-[#f5f7f9]">Draft</span>
                        ) : (
                          <span className="text-[13px] text-[#5e6b7b]">
                            Version {p.publishedVersion}. Accepted by {p.accepted} of {d.members}
                            {!p.acceptedByMe && <span className="text-[#b45309]">, not yet by you</span>}
                          </span>
                        )}
                      </div>
                      {due && <p className="mt-1 text-[13px] text-[#b45309]">Review was due {new Date(p.reviewDueAt!).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>}
                    </Link>
                  );
                })}
              </section>
            )}

            {d.canManage && d.templates.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-[16px] font-semibold text-[#0e1b2c]">Templates</h2>
                <p className="text-[14px] text-[#5e6b7b]">Answer a few questions and AIC writes the policy for you, using what it already knows about your organisation. You can edit every word before publishing.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {d.templates.map((t) => (
                    <div key={t.key} className="bg-white border border-[#dde2e8] rounded-xl p-4 flex flex-col">
                      <p className="text-[15px] font-semibold text-[#0e1b2c]">{t.title}</p>
                      <p className="mt-1 text-[13.5px] text-[#5e6b7b] flex-1">{t.summary}</p>
                      <p className="mt-2 text-[12.5px] text-[#8a95a3]">Evidence towards {t.controls.join(', ')}.</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button onClick={() => router.push(`/policies/new/${t.key}`)} className="h-10 sm:h-9 px-4 rounded-full bg-[#0e1b2c] text-[14px] font-medium text-white hover:bg-[#22344a]">
                          Build it with AIC
                        </button>
                        <button onClick={() => adopt(t.key)} disabled={busy === t.key} className="text-[13px] font-medium text-[#5e6b7b] hover:text-[#0e1b2c] disabled:opacity-50">
                          {busy === t.key ? 'Adopting…' : 'or start from the plain text'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
