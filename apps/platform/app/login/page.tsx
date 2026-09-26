'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { AuthFrame, inputClass, labelClass, PrimaryButton, Notice } from '../components/auth/AuthFrame';

const ssoButton =
  'flex items-center justify-center gap-2 rounded-full border border-[#0a1728]/[0.08] bg-white py-2.5 text-sm font-medium text-[#0A1728] ' +
  'transition-all hover:border-[#0a1728]/[0.16] hover:bg-[#fafbfc]';

/** A one-line welcome for the pages that send people here on purpose. */
function arrivalMessage(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('registered')) return 'Your organisation is registered. Sign in to continue — we’ve also sent a link to confirm your email.';
  if (q.get('activated')) return 'Your account is active. Sign in with your new password.';
  if (q.get('reset')) return 'Password updated. Sign in with your new password.';
  if (q.get('enrolled')) return 'Two-factor is on. Sign in with your password and a code from your app.';
  return null;
}

/**
 * Where to go once signed in. The middleware appends ?next= when it bounces a
 * deep link to this page; that used to be read by nothing, so a bookmarked
 * page always dropped the person on the dashboard instead. It is passed through
 * to /start, which validates it — nothing here trusts it.
 */
function startUrl(): string {
  if (typeof window === 'undefined') return '/start';
  const next = new URLSearchParams(window.location.search).get('next');
  return next ? `/start?next=${encodeURIComponent(next)}` : '/start';
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [arrival, setArrival] = useState<string | null>(null);
  const [prefillEmail, setPrefillEmail] = useState('');
  useEffect(() => {
    setArrival(arrivalMessage());
    setPrefillEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  // Which single sign-on providers are actually configured on the server.
  // The Google and Office 365 buttons used to render unconditionally, for
  // providers registered with empty credentials — so they were always visible
  // and could never complete a sign-in. Asking the server which providers exist
  // means the buttons appear exactly when they work, and adding SSO later is
  // just an env var rather than another edit here.
  const [ssoProviders, setSsoProviders] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, { id: string; type: string }>) => {
        if (cancelled || !data) return;
        setSsoProviders(
          Object.values(data)
            .filter((p) => p && p.type !== 'credentials')
            .map((p) => p.id)
        );
      })
      .catch(() => {
        // A failure here means no SSO buttons, which is the safe direction:
        // better to show only the email form than a button that cannot work.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const mfaToken = formData.get('mfaToken') as string;

    try {
        const result = await signIn('credentials', {
            email,
            password,
            mfaToken,
            redirect: false,
        });

        if (result?.error) {
            /**
             * Auth.js v5 collapses anything thrown inside `authorize` into a
             * single "CredentialsSignin" string. The checks below were written
             * against the messages the server actually throws and therefore
             * never matched: a locked account, a missing MFA token and a wrong
             * password all arrived here identically and all reported "Invalid
             * credentials or insufficient permissions". They are kept because
             * they cost nothing if a future version does propagate the reason,
             * but nothing depends on them any more.
             *
             * The case that matters is asked about directly instead. An account
             * whose role requires MFA and has none cannot be given a session by
             * any password, so a rejection here is not evidence of a bad
             * password — it is the expected answer, and the honest response is
             * to send them somewhere they can enrol. That endpoint re-checks
             * the password itself and answers the same way for a wrong one, so
             * asking costs nothing and reveals nothing.
             */
            let enrolling = false;
            let lockedFor = 0;
            let throttled = false;
            let needsCode = false;
            try {
                const probe = await fetch('/api/auth/mfa/grant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                if (probe.ok) {
                    const d = await probe.json();
                    enrolling = Boolean(d?.enrolmentRequired);
                    if (d?.locked) lockedFor = Number(d.minutes) || 1;
                    if (d?.mfaRequired) needsCode = true;
                } else if (probe.status === 429) {
                    // Say so rather than falling through to "invalid
                    // credentials", which is what made this invisible.
                    throttled = true;
                }
            } catch {
                // Fall through to the ordinary error below.
            }

            if (enrolling) {
                router.push('/mfa/setup');
                return;
            }

            if (throttled) {
                setError('Too many sign-in attempts from here. Wait a few minutes and try again.');
                setIsLoading(false);
                return;
            }

            if (lockedFor) {
                setError(
                    `Your password is correct, but this account is locked after too many failed attempts. Try again in ${lockedFor} minute${lockedFor === 1 ? '' : 's'}.`
                );
                setIsLoading(false);
                return;
            }

            if (needsCode) {
                // The password was right; the second factor is what is missing
                // or wrong. Which of the two depends on whether we sent one.
                setIsMfaRequired(true);
                setError(
                    mfaToken
                        ? 'That code was not accepted. Check your authenticator app and try again.'
                        : 'Enter the 6-digit code from your authenticator app.'
                );
                setIsLoading(false);
                return;
            }

            if (result.error.includes('MFA_REQUIRED')) {
                setIsMfaRequired(true);
                setError('MFA Token Required');
            } else if (result.error.includes('locked')) {
                setError(result.error);
            } else if (isMfaRequired) {
                setError('That code was not accepted. Check the app and try again.');
            } else {
                setError('Invalid credentials or insufficient permissions.');
            }
            setIsLoading(false);
        } else {
            // Routed by /start on the server, which knows the person's role:
            // staff to the staff workspace, clients to theirs, and back to the
            // page they were heading for only if it is safe and theirs to open.
            router.push(startUrl());
        }
    } catch {
        setError('A system error occurred. Please try again later.');
        setIsLoading(false);
    }
  };

  return (
    <AuthFrame
      title="Sign in to AIC"
      subtitle="Your organisation’s AI record, compliance and certification."
      footer={<>New organisation? <Link href="/signup" className="font-medium text-[#0A1728] hover:text-[#c9920a]">Register it — it’s free</Link></>}
    >
      <div className="space-y-5">
        {arrival && !error && <Notice tone="success">{arrival}</Notice>}
        <AnimatePresence>{error && <Notice tone="error">{error}</Notice>}</AnimatePresence>

        {ssoProviders.length > 0 && (
          <>
            <div className={`grid gap-2.5 ${ssoProviders.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {ssoProviders.includes('google') && (
                <button type="button" onClick={() => signIn('google', { callbackUrl: startUrl() })} className={ssoButton}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.08-3.71 1.08-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.75c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
              )}
              {ssoProviders.includes('microsoft-entra-id') && (
                <button type="button" onClick={() => signIn('microsoft-entra-id', { callbackUrl: startUrl() })} className={ssoButton}>
                  <svg className="w-4 h-4" viewBox="0 0 23 23" aria-hidden>
                    <path fill="#F25022" d="M0 0h11v11H0z" /><path fill="#7FBA00" d="M12 0h11v11H12z" />
                    <path fill="#00A4EF" d="M0 12h11v11H0z" /><path fill="#FFB900" d="M12 12h11v11H12z" />
                  </svg>
                  Microsoft
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#a3abb8]">
              <span className="h-px flex-1 bg-[#0a1728]/[0.07]" /> or with email <span className="h-px flex-1 bg-[#0a1728]/[0.07]" />
            </div>
          </>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className={labelClass}>Work email</label>
            <input key={prefillEmail} id="email" name="email" type="email" required autoComplete="email" defaultValue={prefillEmail}
              className={inputClass} placeholder="you@organisation.com" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className={labelClass}>Password</label>
              <Link href="/forgot-password" className="mb-1.5 text-[11px] text-[#8a93a3] hover:text-[#c9920a] transition-colors">Forgot password?</Link>
            </div>
            <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </div>

          <AnimatePresence>
            {isMfaRequired && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label htmlFor="mfaToken" className={labelClass}>Authenticator code</label>
                <input id="mfaToken" name="mfaToken" type="text" required={isMfaRequired} inputMode="numeric"
                  className={`${inputClass} text-center font-mono text-lg tracking-[0.5em]`}
                  placeholder="000000" maxLength={6} pattern="\d{6}" autoComplete="one-time-code" />
              </motion.div>
            )}
          </AnimatePresence>

          <PrimaryButton type="submit" disabled={isLoading} className="mt-2">
            {isLoading ? 'Signing in…' : 'Sign in'}
          </PrimaryButton>
        </form>
      </div>
    </AuthFrame>
  );
}
