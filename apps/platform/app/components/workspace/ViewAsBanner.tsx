'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Eye } from 'lucide-react';

const LABEL: Record<string, string> = {
  ORG_ADMIN: 'Organisation Admin',
  ORG_USER: 'Organisation User',
  AIC_AUDITOR: 'AIC Auditor',
};

/** Shown on every page while a super admin is previewing another role. */
export function ViewAsBanner() {
  const { data } = useSession();
  const viewAs = data?.user?.viewAs;
  const [busy, setBusy] = useState(false);
  if (!viewAs) return null;

  async function exit() {
    setBusy(true);
    await fetch('/api/view-as', { method: 'DELETE' }).catch(() => {});
    window.location.href = '/admin';
  }

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-400 px-4 py-2 text-[13px] font-medium text-[#1a1300]">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-4 w-4" />
        Previewing as <strong>{LABEL[viewAs.role] ?? viewAs.role}</strong>
        {viewAs.orgName && <> of <strong>{viewAs.orgName}</strong></>}
        . Read-only: nothing you do here is saved.
      </span>
      <button onClick={exit} disabled={busy} className="rounded-full bg-[#1a1300] px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-black disabled:opacity-50">
        {busy ? 'Leaving…' : 'Exit preview'}
      </button>
    </div>
  );
}
