'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AuthFrame, inputClass, labelClass, PrimaryButton, Notice } from '../../components/auth/AuthFrame';

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
    <AuthFrame
      title={done ? 'Two-factor is on' : 'Set up your authenticator'}
      subtitle={state === 'ready' && !done ? 'Your role requires a second factor, so this is done once before you can sign in.' : undefined}
    >
      {state === 'loading' && <p className="text-sm text-[#8a93a3]">Preparing your setup key…</p>}

      {state === 'denied' && (
        <div className="space-y-5">
          <Notice>This setup link has expired, or your account already has an authenticator. Sign in again to start over.</Notice>
          <a href="/login" className="inline-flex w-full items-center justify-center rounded-full bg-[#0A1728] px-5 py-3 text-sm font-medium text-white hover:bg-[#13233b]">
            Back to sign in
          </a>
        </div>
      )}

      {state === 'ready' && !done && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[#6b7485]">
            Scan this with any authenticator app, then enter the six-digit code it shows.
          </p>
          {qr && (
            <div className="flex justify-center rounded-2xl bg-[#f7f8fa] p-5">
              <Image src={qr} alt="Authenticator QR code" width={184} height={184} unoptimized className="rounded-lg" />
            </div>
          )}
          <details>
            <summary className="cursor-pointer text-[12px] text-[#8a93a3] hover:text-[#0A1728]">Can&apos;t scan it?</summary>
            <p className="mt-2 break-all rounded-xl bg-[#f7f8fa] p-3 font-mono text-xs text-[#4b5566]">{secret}</p>
          </details>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className={labelClass}>Six-digit code</label>
              <input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
              />
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            <PrimaryButton type="submit" disabled={saving || code.length !== 6}>
              {saving ? 'Checking…' : 'Turn on two-factor'}
            </PrimaryButton>
          </form>
        </div>
      )}

      {done && (
        <Notice tone="success">Taking you back to sign in — you’ll need your password and a code from the app.</Notice>
      )}
    </AuthFrame>
  );
}
