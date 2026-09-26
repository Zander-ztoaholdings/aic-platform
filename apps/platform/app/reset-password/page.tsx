'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFrame, Notice } from '../components/auth/AuthFrame';
import { SetPasswordForm } from '../components/auth/SetPasswordForm';

function ResetPasswordContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');
  const [done, setDone] = useState(false);

  // Invite links used to come here. They now go to /invite; an old one that
  // still arrives is forwarded rather than treated as a reset.
  if (token && params.get('invite') === '1') {
    if (typeof window !== 'undefined') router.replace(`/invite?token=${encodeURIComponent(token)}`);
    return null;
  }

  if (!token) {
    return (
      <AuthFrame title="This link is incomplete" subtitle="The reset link is missing its token. Request a new one.">
        <Link href="/forgot-password" className="text-sm font-medium text-[#0A1728] hover:text-[#c9920a]">Request a new link →</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title={done ? 'Password updated' : 'Choose a new password'}
      subtitle={done ? undefined : 'You’ll use it with your email to sign in.'}
      footer={<Link href="/forgot-password" className="hover:text-[#0A1728]">Link expired? Request a new one</Link>}
    >
      {done ? (
        <div className="space-y-4">
          <Notice tone="success">Your password has been changed. Taking you to sign in…</Notice>
        </div>
      ) : (
        <SetPasswordForm token={token} submitLabel="Update password" onDone={() => { setDone(true); setTimeout(() => router.push('/login?reset=1'), 1600); }} />
      )}
    </AuthFrame>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
