'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { AuthFrame, Notice } from '../components/auth/AuthFrame';

function VerifyEmailContent() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    // Tokens are single-use; React's development double-invoke would burn it.
    if (ran.current) return;
    ran.current = true;
    if (!token) { setStatus('error'); setMessage('This verification link is incomplete.'); return; }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setStatus('success');
        else { setStatus('error'); setMessage(data.error || 'This link has expired or has already been used.'); }
      })
      .catch(() => { setStatus('error'); setMessage('Could not reach AIC. Check your connection and try again.'); });
  }, [token]);

  return (
    <AuthFrame
      title={status === 'success' ? 'Email confirmed' : status === 'error' ? 'We couldn’t confirm that link' : 'Confirming your email'}
    >
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-[#8a93a3]"><Loader2 className="h-4 w-4 animate-spin" /> One moment</div>
      )}
      {status === 'success' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 text-sm text-[#4b5566]">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Thank you — your address is confirmed.
          </div>
          <Link href="/start" className="inline-flex w-full items-center justify-center rounded-full bg-[#0A1728] px-5 py-3 text-sm font-medium text-white hover:bg-[#13233b]">
            Continue to AIC
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-4">
          <Notice tone="error">{message}</Notice>
          <p className="text-[13px] leading-relaxed text-[#6b7485]">
            If you’re signed in, you can send a new link from AIC Aware. Links expire after 48 hours.
          </p>
          <Link href="/start" className="text-sm font-medium text-[#0A1728] hover:text-[#a8772a]">Go to AIC</Link>
        </div>
      )}
    </AuthFrame>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
