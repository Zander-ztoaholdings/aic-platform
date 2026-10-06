'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { patchFetch, pinUser, pinnedUser, onSuspectChange, SESSION_CHANGE_KEY } from '@/lib/session-guard';

type Mismatch = { kind: 'other'; email: string | null } | { kind: 'signed-out' };

/**
 * Stops a tab from carrying on as an account the browser is no longer signed
 * in to. When another tab signs in as someone else, or signs out, this tab
 * blocks itself with a plain explanation instead of quietly working against
 * the other account. The server refuses the stale tab's API calls as well
 * (lib/session-guard.ts), so this is the explanation, not the protection.
 */
export function SessionGuard() {
  const { data, status } = useSession();
  const pathname = usePathname();
  const [mismatch, setMismatch] = useState<Mismatch | null>(null);

  useEffect(() => { patchFetch(); }, []);
  useEffect(() => {
    if (status === 'authenticated' && data?.user?.id) pinUser(data.user.id);
  }, [status, data?.user?.id]);

  const check = useCallback(async () => {
    const mine = pinnedUser();
    if (!mine) return;
    try {
      const r = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!r.ok) return;
      const s = (await r.json().catch(() => null)) as { user?: { id?: string; email?: string } } | null;
      const now = s?.user?.id ?? null;
      if (!now) setMismatch({ kind: 'signed-out' });
      else if (now !== mine) setMismatch({ kind: 'other', email: s?.user?.email ?? null });
      else setMismatch(null);
    } catch {
      // Offline: nothing to conclude.
    }
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === SESSION_CHANGE_KEY) void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const off = onSuspectChange(() => void check());
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      off();
    };
  }, [check]);

  // The sign-in pages manage the change themselves.
  if (!mismatch || pathname?.startsWith('/login')) return null;

  const signedOut = mismatch.kind === 'signed-out';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1728]/60 px-4" role="alertdialog" aria-modal="true" aria-labelledby="session-guard-title">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="session-guard-title" className="font-serif text-[20px] font-semibold text-[#0e1b2c]">
          {signedOut ? 'You signed out in another tab' : 'This browser is now signed in to a different account'}
        </h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#2b3a4d]">
          {signedOut
            ? 'This page belongs to the account that signed out, so it has stopped saving anything. Sign in again to carry on.'
            : <>Another tab signed in as {mismatch.email ? <strong className="font-semibold text-[#0e1b2c]">{mismatch.email}</strong> : 'someone else'}. This page was opened for a different account, so it has stopped saving anything to avoid putting your work in the wrong place. Reload to continue as the account that is signed in now.</>}
        </p>
        <p className="mt-2 text-[13px] text-[#5e6b7b]">A browser can only hold one AIC account at a time. To use two at once, open the second in a private window or another browser profile.</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => { window.location.href = signedOut ? '/login' : window.location.pathname; }}
            className="h-11 rounded-full bg-[#0e1b2c] px-5 text-[14px] font-medium text-white hover:bg-[#22344a]">
            {signedOut ? 'Go to sign in' : 'Reload this page'}
          </button>
        </div>
      </div>
    </div>
  );
}
