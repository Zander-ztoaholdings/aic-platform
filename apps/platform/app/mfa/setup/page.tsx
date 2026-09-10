'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * Enrolment, for someone who cannot sign in until they have enrolled.
 *
 * Reached from the login form after a correct password on an account where MFA
 * is mandatory and absent. The authority to be here is the httpOnly grant
 * cookie the login form obtained; this page never sees it and never handles the
 * password.
 */
export default function MfaSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/mfa/setup')
      .then(async (r) => {
        if (!r.ok) throw new Error('unauthorized');
        return r.json();
      })
      .then((d: { secret: string; qrCode: string }) => {
        if (cancelled) return;
        setSecret(d.secret);
        setQr(d.qrCode);
        setState('ready');
      })
      .catch(() => !cancelled && setState('denied'));
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSaving(true);
      try {
        const r = await fetch('/api/auth/mfa/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, token: code.trim() }),
        });
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || 'That code was not accepted.');
          setSaving(false);
          return;
        }
        setDone(true);
        // Straight back to the login form, where the password plus the code
        // from the app they have just set up will now produce a session.
        setTimeout(() => router.push('/login?enrolled=1'), 1400);
      } catch {
        setError('Something went wrong. Please try again.');
        setSaving(false);
      }
    },
    [secret, code, router]
  );

  return (
    <div className="min-h-screen bg-[#0a1628] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-8">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#c9920a]">
          One more step
        </span>
        <h1 className="text-2xl font-bold mt-2 mb-3">Set up your authenticator</h1>

        {state === 'loading' && (
          <p className="text-white/60 text-sm">Preparing your setup key…</p>
        )}

        {state === 'denied' && (
          <div className="text-sm text-white/70 leading-relaxed">
            <p className="mb-4">
              This setup link has expired, or your account already has an
              authenticator. Sign in again to start over.
            </p>
            <a
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[#c9920a] text-[#0a1628] font-semibold rounded-lg px-4 py-3"
            >
              Back to sign in
            </a>
          </div>
        )}

        {state === 'ready' && !done && (
          <>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Your role requires a second factor, so this has to be done once
              before you can sign in. Scan this with any authenticator app, then
              enter the six-digit code it shows.
            </p>

            {qr && (
              <div className="bg-white rounded-xl p-4 flex justify-center mb-4">
                <Image src={qr} alt="Authenticator QR code" width={200} height={200} unoptimized />
              </div>
            )}

            <details className="mb-6">
              <summary className="text-xs text-white/50 cursor-pointer hover:text-white/80">
                Can&apos;t scan it?
              </summary>
              <p className="mt-2 text-xs text-white/60 break-all font-mono bg-black/30 rounded-lg p-3">
                {secret}
              </p>
            </details>

            <form onSubmit={submit}>
              <label htmlFor="mfa-code" className="block text-sm text-white/70 mb-2">
                Six-digit code
              </label>
              <input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="w-full bg-black/30 border border-white/15 rounded-lg px-4 py-3 tracking-[0.4em] text-center font-mono focus:outline-none focus:border-[#c9920a]"
              />
              {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
              <button
                type="submit"
                disabled={saving || code.length !== 6}
                className="w-full mt-5 bg-[#c9920a] text-[#0a1628] font-semibold rounded-lg px-4 py-3 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Checking…' : 'Turn on two-factor'}
              </button>
            </form>
          </>
        )}

        {done && (
          <p className="text-sm text-white/80 leading-relaxed">
            Two-factor is on. Taking you back to sign in — you will need your
            password and a code from the app.
          </p>
        )}
      </div>
    </div>
  );
}
