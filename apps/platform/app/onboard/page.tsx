'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame, inputClass, labelClass, PrimaryButton, Notice } from '../components/auth/AuthFrame';

/**
 * Account creation for an organisation AIC has approved from a lead (the HQ
 * "convert" action emails this link with a single-use code). Self-serve
 * organisations register at /signup; invited colleagues accept at /invite.
 */
function OnboardContent() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('code');
  const orgId = params.get('org');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 12) return setError('Use at least 12 characters for your password.');
    if (form.password !== form.confirmPassword) return setError('The two passwords do not match.');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, inviteCode: code, orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push(`/login?activated=1&email=${encodeURIComponent(form.email)}`), 1400);
      } else {
        setError(data.error === 'Invalid or expired invite code' ? 'This link has expired or has already been used. Contact AIC for a new one.' : data.error || 'Could not create your account.');
      }
    } catch {
      setError('Could not reach AIC. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  if (!code) {
    return (
      <AuthFrame title="This link is incomplete">
        <Notice tone="error">The account link is missing its code. Use the link from your email, or contact AIC.</Notice>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title={done ? 'Your account is ready' : 'Create your account'}
      subtitle={done ? undefined : 'Your organisation has been approved for AIC. Set up the administrator account to get started.'}
    >
      {done ? (
        <Notice tone="success">Taking you to sign in…</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          <div>
            <label htmlFor="name" className={labelClass}>Full name</label>
            <input id="name" required autoComplete="name" className={inputClass} value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Work email</label>
            <input id="email" type="email" required autoComplete="email" className={inputClass} value={form.email} onChange={set('email')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pw" className={labelClass}>Password</label>
              <input id="pw" type="password" required autoComplete="new-password" className={inputClass} value={form.password} onChange={set('password')} />
            </div>
            <div>
              <label htmlFor="pw2" className={labelClass}>Confirm</label>
              <input id="pw2" type="password" required autoComplete="new-password" className={inputClass} value={form.confirmPassword} onChange={set('confirmPassword')} />
            </div>
          </div>
          <p className="text-[12px] text-[#a3abb8]">At least 12 characters.</p>
          <PrimaryButton type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</PrimaryButton>
        </form>
      )}
    </AuthFrame>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={null}>
      <OnboardContent />
    </Suspense>
  );
}
