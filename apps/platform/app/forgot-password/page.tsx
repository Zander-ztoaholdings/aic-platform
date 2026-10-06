'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthFrame, inputClass, labelClass, PrimaryButton, Notice } from '../components/auth/AuthFrame';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMessage(data.message);
      else setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Could not reach AIC. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      title={message ? 'Check your inbox' : 'Reset your password'}
      subtitle={message ? undefined : 'Enter the email you sign in with and we’ll send you a link to choose a new password.'}
      footer={<>Remembered it? <Link href="/login" className="font-medium text-[#0A1728] hover:text-[#a8772a]">Sign in</Link></>}
    >
      {message ? (
        <div className="space-y-5">
          <Notice tone="success">{message}</Notice>
          <p className="text-[13px] leading-relaxed text-[#6b7485]">
            The link works once and expires in an hour. If nothing arrives in a few minutes, check your spam folder.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <Notice tone="error">{error}</Notice>}
          <div>
            <label htmlFor="email" className={labelClass}>Work email</label>
            <input id="email" type="email" required autoComplete="email" autoFocus className={inputClass}
              placeholder="you@organisation.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <PrimaryButton type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</PrimaryButton>
        </form>
      )}
    </AuthFrame>
  );
}
