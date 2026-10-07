'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Waiting: people invited to the organisation who have not accepted yet.
 * Sits beside the team settings so an admin can see at a glance who still
 * has to act, resend a link that expired, or withdraw one sent in error.
 */

type Pending = {
  id: string; name: string | null; email: string; role: string; roleKey: string;
  invitedAt: string; lastSentAt: string; linkExpiresAt: string | null;
};

const DAY = 86_400_000;

function since(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

function linkState(p: Pending): { text: string; tone: string } {
  if (!p.linkExpiresAt) return { text: 'No live link', tone: 'text-[#b45309]' };
  const left = Math.ceil((new Date(p.linkExpiresAt).getTime() - Date.now()) / DAY);
  if (left <= 0) return { text: 'Link expired', tone: 'text-[#b45309]' };
  return { text: left === 1 ? 'Link expires tomorrow' : `Link expires in ${left} days`, tone: 'text-[#5e6b7b]' };
}

export function WaitingPanel({ refreshKey }: { refreshKey: number }) {
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/users/invite');
    if (!r.ok) { setPending([]); return; }
    const j = (await r.json()) as { pending: Pending[]; canManage: boolean };
    setPending(j.pending);
    setCanManage(j.canManage);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function resend(p: Pending) {
    setBusy(p.id);
    const r = await fetch('/api/users/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.email, name: p.name || p.email.split('@')[0], role: p.roleKey }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { toast.error(j.error ?? 'Could not resend the invitation.'); return; }
    if (j.emailed) toast.success(`A fresh link went to ${p.email}.`);
    else toast.warning(j.message ?? 'The link was created but the email could not be sent.');
    load();
  }

  async function withdraw(p: Pending) {
    if (!confirm(`Withdraw the invitation to ${p.email}? The link in their email stops working.`)) return;
    setBusy(p.id);
    const r = await fetch('/api/users/invite', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { toast.error(j.error ?? 'Could not withdraw the invitation.'); return; }
    toast.success(j.message ?? 'Invitation withdrawn.');
    load();
  }

  const count = pending?.length ?? 0;

  return (
    <aside aria-labelledby="waiting-heading" className={`${count === 0 ? 'hidden lg:block' : ''} lg:sticky lg:top-28 bg-white border border-[#dde2e8] rounded-xl p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="waiting-heading" className="text-base font-semibold text-[#0e1b2c]">Waiting</h2>
        {count > 0 && <span className="text-[13px] text-[#5e6b7b]">{count} {count === 1 ? 'invitation' : 'invitations'}</span>}
      </div>
      {pending === null ? (
        <p className="mt-3 text-[13.5px] text-[#5e6b7b]">Loading…</p>
      ) : count === 0 ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#5e6b7b]">Nobody is waiting. When you invite someone, they show here until they accept.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#eef1f5]">
          {pending.map((p) => {
            const link = linkState(p);
            return (
              <li key={p.id} className="py-3 first:pt-1">
                <p className="text-[14px] font-medium text-[#0e1b2c] break-words">Waiting for {p.name || p.email} to accept</p>
                {p.name && <p className="text-[13px] text-[#5e6b7b] break-all">{p.email}</p>}
                <p className="mt-0.5 text-[12.5px] text-[#8a95a3]">{p.role}. Invited {since(p.invitedAt)}{p.lastSentAt !== p.invitedAt ? `, last sent ${since(p.lastSentAt)}` : ''}.</p>
                <p className={`text-[12.5px] ${link.tone}`}>{link.text}</p>
                {canManage && (
                  <div className="mt-1.5 flex gap-1">
                    <button type="button" disabled={busy === p.id} onClick={() => resend(p)} className="min-h-[36px] px-2 -ml-2 text-[13px] font-medium text-[#8a6114] hover:underline disabled:opacity-50">Resend link</button>
                    <button type="button" disabled={busy === p.id} onClick={() => withdraw(p)} className="min-h-[36px] px-2 text-[13px] font-medium text-[#b23a35] hover:underline disabled:opacity-50">Withdraw</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
