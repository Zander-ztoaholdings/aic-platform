'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthFrame, Notice } from '../components/auth/AuthFrame';
import { SetPasswordForm } from '../components/auth/SetPasswordForm';

interface Invite { email: string; name: string | null; organisation: string | null; role: string }

/**
 * Where an invitation email lands. Says who the invitation is from before
 * asking for anything, then sets the password — which activates the account
 * and confirms the email address in one step.
 */
function InviteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setError('This invitation link is incomplete.'); return; }
    fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setInvite(d); else setError(d.error || 'This invitation is not valid.');
      })
      .catch(() => setError('Could not reach AIC. Check your connection and try again.'));
  }, [token]);

  if (error) {
    return (
      <AuthFrame title="Invitation unavailable">
        <Notice tone="error">{error}</Notice>
      </AuthFrame>
    );
  }

  if (!invite) {
    return (
      <AuthFrame title="Opening your invitation">
        <div className="flex items-center gap-2 text-sm text-[#8a93a3]"><Loader2 className="h-4 w-4 animate-spin" /> One moment</div>
      </AuthFrame>
    );
  }

  const first = invite.name?.split(' ')[0];
  return (
    <AuthFrame
      title={done ? `Welcome to ${invite.organisation ?? 'AIC'}` : `${first ? `${first}, you’re` : 'You’re'} invited`}
      subtitle={
        done ? undefined : (
          <>Join <span className="font-medium text-[#0A1728]">{invite.organisation ?? 'your organisation'}</span> on AIC as {invite.role}. Choose a password to activate your account.</>
        )
      }
    >
      {done ? (
        <Notice tone="success">Your account is active. Taking you to sign in…</Notice>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-sm">
            <div className="text-[11px] text-[#8a93a3]">You’ll sign in as</div>
            <div className="mt-0.5 font-medium text-[#0A1728]">{invite.email}</div>
          </div>
          <SetPasswordForm
            token={token}
            submitLabel="Accept and continue"
            onDone={() => { setDone(true); setTimeout(() => router.push(`/login?activated=1&email=${encodeURIComponent(invite.email)}`), 1400); }}
          />
        </div>
      )}
    </AuthFrame>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
