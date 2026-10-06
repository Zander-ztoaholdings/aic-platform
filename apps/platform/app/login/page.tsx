'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

/**
 * The way back out.
 *
 * Signing out lands on /login, and /login had no route to the public site —
 * the string in the corner was decoration, not a link. Anyone who logged out
 * was stuck on a login screen with nowhere to go but back in or the browser's
 * back button. Overridable by env so a staging deployment does not send people
 * to production.
 */
const AIC_WEB = process.env.NEXT_PUBLIC_AIC_WEB_URL || 'https://aiccertified.cloud';

function BrandMark() {
  return (
    <svg viewBox="0 0 110 180" className="h-14 md:h-16 w-auto flex-shrink-0">
      <path d="M36,1 L1,1 L1,179 L36,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M74,1 L109,1 L109,179 L74,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <text x="55" y="20" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">METHODOLOGY</text>
      <text x="55" y="31" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">ASSESSED</text>
      <line x1="8" y1="41" x2="102" y2="41" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="100" fontSize="40" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="5" fontFamily="Space Grotesk,sans-serif">AIC</text>
      <line x1="8" y1="122" x2="102" y2="122" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="148" fontSize="5" fill="#a8772a" textAnchor="middle" letterSpacing="1.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">AICCERTIFIED.CLOUD</text>
    </svg>
  );
}

/**
 * A one-line welcome for the pages that send people here on purpose:
 * registration, invite acceptance, password reset and MFA enrolment.
 */
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f0f4f8]">
      {/* LEFT PANEL - Dark Navy */}
      <div className="w-full md:w-[45%] bg-[#0a1628] px-6 pt-7 pb-16 md:p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#a8772a]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#a8772a]/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 flex items-center gap-5 md:block md:space-y-8">
          <BrandMark />
          
          <div className="space-y-1 md:space-y-4">
            <div className="text-[12px] text-[#a8772a] first-cap font-bold">
              AIC Pulse
            </div>
            <h1 className="font-serif text-[22px] md:text-3xl font-bold text-white leading-tight">
              AI Accountability Platform
            </h1>
            <p className="hidden md:block text-sm text-white/50 max-w-sm leading-relaxed">
              Certifying that human empathy remains in the loop for every consequential automated decision.
            </p>
          </div>

          <div className="hidden md:block space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a8772a]"></div>
              <p className="text-[12px] text-white/70 first-cap">Independent Algorithmic Auditing</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a8772a]"></div>
              <p className="text-[12px] text-white/70 first-cap">Real-time Risk Monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#a8772a]"></div>
              <p className="text-[12px] text-white/70 first-cap">Stakeholder Transparency</p>
            </div>
          </div>
        </div>

        <a
          href={AIC_WEB}
          className="hidden md:block md:absolute md:bottom-12 md:left-16 text-white/40 hover:text-white/80 transition-colors text-[12px] first-cap"
        >
          &larr; aiccertified.cloud
        </a>
      </div>

      {/* RIGHT PANEL - White Form */}
      <div className="w-full md:w-[55%] flex items-start md:items-center justify-center px-4 pb-10 -mt-10 md:mt-0 md:p-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#dde2e8] rounded-2xl p-5 md:p-8 shadow-sm max-w-sm w-full space-y-8"
        >
          <div className="space-y-3">
            <a
              href={AIC_WEB}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dde2e8] bg-[#f8f9fb] px-3 py-1.5 text-[12px] font-bold text-[#5e6b7b] first-cap transition-colors hover:border-[#a8772a]/40 hover:bg-[#a8772a]/[0.06] hover:text-[#a8772a]"
            >
              <span aria-hidden="true" className="text-xs leading-none">&larr;</span> Back to aiccertified.cloud
            </a>
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-bold text-[#0e1b2c]">Welcome back</h2>
              <p className="text-[12px] text-[#8a95a3] first-cap">
                Sign in to the AIC Platform
              </p>
            </div>
          </div>

          {arrival && !error && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] leading-relaxed">
              {arrival}
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {/* SSO buttons — rendered only for providers the server actually has */}
            {ssoProviders.length > 0 && (
            <div className={`grid gap-3 ${ssoProviders.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {ssoProviders.includes('google') && (
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: startUrl() })}
                className="flex items-center justify-center gap-2 border border-[#dde2e8] rounded-xl py-2.5 text-[11.5px] font-bold text-[#5e6b7b] hover:border-[#a8772a] hover:text-[#a8772a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.08-3.71 1.08-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.75c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              )}
              {ssoProviders.includes('microsoft-entra-id') && (
              <button
                type="button"
                onClick={() => signIn('microsoft-entra-id', { callbackUrl: startUrl() })}
                className="flex items-center justify-center gap-2 border border-[#dde2e8] rounded-xl py-2.5 text-[11.5px] font-bold text-[#5e6b7b] hover:border-[#a8772a] hover:text-[#a8772a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 23 23">
                  <path fill="currentColor" d="M0 0h11v11H0z" />
                  <path fill="currentColor" d="M12 0h11v11H12z" />
                  <path fill="currentColor" d="M0 12h11v11H0z" />
                  <path fill="currentColor" d="M12 12h11v11H12z" />
                </svg>
                OFFICE 365
              </button>
              )}
            </div>
            )}

            {ssoProviders.length > 0 && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#dde2e8]"></span>
              </div>
              <div className="relative flex justify-center text-[12px] font-bold text-[#8a95a3] first-cap">
                <span className="bg-white px-3">or continue with email</span>
              </div>
            </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-[12px] font-bold first-cap text-[#5e6b7b]">
                  Work email
                </label>
                <input 
                  key={prefillEmail}
                  defaultValue={prefillEmail}
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  className="w-full border border-[#dde2e8] rounded-lg px-3 py-2.5 text-sm text-[#0e1b2c] focus:outline-none focus:border-[#a8772a] transition-colors bg-white"
                  placeholder="you@organisation.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block text-[12px] font-bold first-cap text-[#5e6b7b]">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[12px] text-[#8a95a3] hover:text-[#a8772a] transition-colors"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  className="w-full border border-[#dde2e8] rounded-lg px-3 py-2.5 text-sm text-[#0e1b2c] focus:outline-none focus:border-[#a8772a] transition-colors bg-white"
                  placeholder="••••••••"
                />
              </div>

              <AnimatePresence>
                {isMfaRequired && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <label htmlFor="mfaToken" className="block text-[12px] font-bold first-cap text-[#a8772a]">
                      MFA Verification
                    </label>
                    <input 
                      id="mfaToken" 
                      name="mfaToken" 
                      type="text" 
                      required={isMfaRequired}
                      className="w-full border border-[#a8772a]/40 bg-amber-50/30 rounded-lg px-3 py-3 text-lg tracking-[0.5em] text-center focus:outline-none focus:border-[#a8772a] transition-colors text-[#0e1b2c]"
                      placeholder="000000"
                      maxLength={6}
                      pattern="\d{6}"
                      autoComplete="one-time-code"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#a8772a] text-white rounded-full py-2.5 text-[12px] font-bold first-cap hover:bg-[#b07d08] transition-colors disabled:opacity-50 mt-4 shadow-sm"
              >
                {isLoading ? 'Authorising…' : 'Access Portal'}
              </button>
            </form>
          </div>

          <div className="text-center">
            <p className="text-[12px] text-[#8a95a3] first-cap">
              New organisation?{' '}
              <Link href="/signup" className="font-bold text-[#5e6b7b] hover:text-[#a8772a] transition-colors">
                Register it &rarr;
              </Link>
            </p>
          </div>

          <div className="text-center">
            <p className="text-[12px] text-[#8a95a3] first-cap">
              Protected by AIC Secure Auth v2.1<br/>
              Continuous integrity monitoring
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
