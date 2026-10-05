'use client';

import { useEffect, useState } from 'react';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import AdminShell from '@/app/components/admin/AdminShell';
import { Button } from '@/app/components/admin/ui';

type Result = {
  credentials: { emails: string[]; password: string; totpSecret: string; otpauth: string };
  summary: Record<string, number>;
  qr: string;
};

/**
 * Build or reset Highveld Credit (Demo). The sign-in details are shown once,
 * here, and never stored in a readable form: copy them into the password
 * manager before leaving the page.
 */
export default function DemoCompanyPage() {
  const [state, setState] = useState<{ exists: boolean; trustSlug: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [r, setR] = useState<Result | null>(null);

  useEffect(() => { fetch('/api/v1/admin/demo', { cache: 'no-store' }).then(async (x) => { const j = await x.json(); if (!x.ok) throw new Error(j.error); setState(j); }).catch((e) => setErr(e.message)); }, []);

  async function build() {
    if (state?.exists && !window.confirm('This deletes the demo company and everything done in it, then builds it fresh. Continue?')) return;
    setBusy(true); setErr(''); setR(null);
    const x = await fetch('/api/v1/admin/demo', { method: 'POST' });
    const j = await x.json().catch(() => ({}));
    setBusy(false);
    if (!x.ok) { setErr(j.error ?? 'Could not build the demo company.'); return; }
    setR(j); setState((s) => (s ? { ...s, exists: true } : s));
  }

  return (
    <AdminShell>
      <Eyebrow>Administration</Eyebrow>
      <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Demo company</h1>
      <p className="mt-1 max-w-2xl text-sm text-[#5e6b7b]">
        Highveld Credit (Demo) is a fictional lender with three months of decisions, four policies, connected systems with findings,
        AI spend near its budget and three declines waiting for a person. Rebuilding it resets everything a previous demo changed.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={busy || !state} onClick={build}>{busy ? 'Building… (about a minute)' : state?.exists ? 'Reset the demo company' : 'Build the demo company'}</Button>
        {state && <span className="text-sm text-[#5e6b7b]">{state.exists ? 'It exists.' : 'It has not been built yet.'}</span>}
      </div>
      {err && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      {r && (
        <section className="mt-6 max-w-3xl rounded-xl border border-[#a8772a]/40 bg-white p-5">
          <p className="text-[15px] font-semibold text-[#0e1b2c]">Sign-in details, shown once</p>
          <p className="mt-1 text-[13px] text-[#5e6b7b]">Save these in the password manager now. Every person uses the same password and authenticator code; the next reset replaces both.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_auto]">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-[#8a95a3]">Sign in as</dt><dd className="mt-0.5 space-y-0.5 font-mono text-[13px] text-[#0e1b2c]">{r.credentials.emails.map((e) => <div key={e}>{e}</div>)}</dd></div>
              <div><dt className="text-[#8a95a3]">Password</dt><dd className="mt-0.5 select-all font-mono text-[13px] text-[#0e1b2c]">{r.credentials.password}</dd></div>
              <div><dt className="text-[#8a95a3]">Authenticator key (if you cannot scan)</dt><dd className="mt-0.5 select-all break-all font-mono text-[13px] text-[#0e1b2c]">{r.credentials.totpSecret}</dd></div>
            </dl>
            <img src={r.qr} alt="Authenticator QR code for the demo accounts" className="h-40 w-40 rounded-lg border border-[#dde2e8]" />
          </div>
          <p className="mt-4 text-[13px] text-[#5e6b7b]">
            Built: {Object.entries(r.summary).map(([k, v]) => `${v.toLocaleString('en-ZA')} ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join(', ')}.
            The Trust page (/trust/{state?.trustSlug}) starts switched off; switch it on from Naledi&apos;s account for the demo.
          </p>
        </section>
      )}
    </AdminShell>
  );
}
