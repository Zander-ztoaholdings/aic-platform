'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "I am me": before anything opens, the person proves they are the one the
 * record was shared with, by entering their address and the code sent to it.
 */
export function ShareGate({ token, hint, orgName }: { token: string; hint: string; orgName: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch(`/api/shared/${token}/code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Something went wrong. Try again.'); return; }
    setMsg(j.message); setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await fetch(`/api/shared/${token}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'That did not work.'); return; }
    router.refresh();
  }

  const input = 'mt-1 h-12 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-[16px] text-[#0e1b2c] outline-none focus:border-[#a8772a]';
  return (
    <div className="rounded-2xl border border-[#dde2e8] bg-white p-6 sm:p-8">
      <h2 className="text-[20px] font-semibold text-[#0e1b2c]">Confirm it is you</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#5e6b7b]">
        {orgName} shared this record with one person, at {hint}. Enter that address and AIC will send it a six-digit code.
      </p>
      {step === 'email' ? (
        <form onSubmit={ask} className="mt-5 space-y-4">
          <label className="block text-[13.5px] font-medium text-[#0e1b2c]">Your email address
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <button type="submit" disabled={busy || !email.trim()} className="h-12 w-full rounded-full bg-[#0e1b2c] text-[15px] font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Sending…' : 'Send me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-4">
          <p className="rounded-xl bg-[#f5f7f9] px-3.5 py-2.5 text-[13.5px] text-[#2b3a4d]">{msg}</p>
          <label className="block text-[13.5px] font-medium text-[#0e1b2c]">Six-digit code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={`${input} tracking-[0.3em] tabular-nums`} />
          </label>
          <button type="submit" disabled={busy || code.length !== 6} className="h-12 w-full rounded-full bg-[#0e1b2c] text-[15px] font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Checking…' : 'Open the record'}</button>
          <button type="button" onClick={() => { setStep('email'); setCode(''); setMsg(''); }} className="w-full text-[13.5px] font-medium text-[#8a6114] hover:underline">Use a different address, or send a new code</button>
        </form>
      )}
      {err && <p role="alert" className="mt-3 text-[13.5px] text-[#b23a35]">{err}</p>}
    </div>
  );
}
