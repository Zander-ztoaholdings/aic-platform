'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Eye } from 'lucide-react';

interface Options {
  roles: { role: string; label: string; needsOrganisation: boolean }[];
  organisations: { id: string; name: string }[];
}

/** Lets a super admin preview the platform as another role sees it. */
export function ViewAsPicker() {
  const { data } = useSession();
  const real = data?.user?.realIsSuperAdmin && !data?.user?.viewAs;
  const [opts, setOpts] = useState<Options | null>(null);
  const [role, setRole] = useState('ORG_ADMIN');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!real) return;
    fetch('/api/view-as').then((r) => r.json()).then((d) => {
      if (d.roles) { setOpts(d); setOrgId(d.organisations[0]?.id ?? ''); }
    }).catch(() => {});
  }, [real]);

  if (!real || !opts) return null;
  const needsOrg = opts.roles.find((r) => r.role === role)?.needsOrganisation;

  async function start() {
    setBusy(true); setError('');
    const res = await fetch('/api/view-as', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, orgId: needsOrg ? orgId : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || 'Could not start the preview.'); setBusy(false); return; }
    window.location.href = d.home;
  }

  const field = 'w-full sm:w-auto rounded-xl border border-[#dde2e8] bg-white px-3 h-11 text-sm text-[#0e1b2c] outline-none focus:border-[#a8772a]';

  return (
    <section className="mb-8 rounded-2xl border border-[#e7d9b8] bg-[#fbf7ee] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#8a6a1f]"><Eye className="h-4 w-4" /> View as another role</div>
      <p className="mt-1 text-[13px] text-[#5e6b7b] max-w-2xl">
        See the platform exactly as that role sees it: the same menus, pages and permission checks. Read-only; ends after two hours or when you exit.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={role} onChange={(e) => setRole(e.target.value)} className={field} aria-label="Role">
          {opts.roles.map((r) => <option key={r.role} value={r.role} className="text-black">{r.label}</option>)}
        </select>
        {needsOrg && (
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={field} aria-label="Organisation">
            {opts.organisations.length === 0 && <option value="">No organisations yet</option>}
            {opts.organisations.map((o) => <option key={o.id} value={o.id} className="text-black">{o.name}</option>)}
          </select>
        )}
        <button onClick={start} disabled={busy || (needsOrg && !orgId)} className="w-full sm:w-auto rounded-full bg-[#0e1b2c] px-5 h-11 text-sm font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">
          {busy ? 'Starting…' : 'Start preview'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
  );
}
