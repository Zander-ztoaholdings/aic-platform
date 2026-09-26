'use client';

import { useState } from 'react';
import { inputClass, labelClass, PrimaryButton, Notice } from './AuthFrame';

const MIN = 12;

/** New password + confirmation, posted to /api/auth/reset-password with a token. */
export function SetPasswordForm({
  token,
  submitLabel,
  onDone,
}: {
  token: string;
  submitLabel: string;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const long = password.length >= MIN;
  const match = confirm.length > 0 && confirm === password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!long) return setError(`Use at least ${MIN} characters.`);
    if (!match) return setError('The two passwords do not match.');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onDone();
      else setError(data.error === 'Invalid or expired token' ? 'This link has expired or has already been used.' : data.error || 'Could not set the password.');
    } catch {
      setError('Could not reach AIC. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <label htmlFor="pw" className={labelClass}>New password</label>
        <input id="pw" type="password" autoComplete="new-password" required autoFocus className={inputClass}
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className={`mt-1.5 text-[12px] transition-colors ${long ? 'text-emerald-600' : 'text-[#a3abb8]'}`}>
          {long ? '✓ ' : ''}At least {MIN} characters
        </p>
      </div>
      <div>
        <label htmlFor="pw2" className={labelClass}>Confirm password</label>
        <input id="pw2" type="password" autoComplete="new-password" required className={inputClass}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <PrimaryButton type="submit" disabled={loading || !long || !match}>{loading ? 'Saving…' : submitLabel}</PrimaryButton>
    </form>
  );
}
