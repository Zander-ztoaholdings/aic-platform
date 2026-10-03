'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/app/components/admin/AdminShell';
import { Button, Panel, Pill, Section, field, ago } from '@/app/components/admin/ui';

interface Org {
  id: string; name: string; division?: number | null; certificationStatus?: string | null;
  memberCount?: number; activeMembers?: number; createdAt?: string | null; created_at?: string | null;
}

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Org | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/organizations', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || 'You do not have access to the register.'); setOrgs([]); return; }
    setOrgs(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (orgs ?? []).filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase())), [orgs, q]);

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold text-white">Organisations</h1>
      <p className="mt-1 text-sm text-white/55">Client organisations and their people. Suspend access, rename, or delete an empty organisation.</p>
      <input className={`${field} mt-6 max-w-sm`} placeholder="Search organisations" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/[0.03] text-xs text-white/45">
            <tr><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">People</th><th className="px-4 py-3 font-medium">Certification</th><th className="px-4 py-3 font-medium">Registered</th><th /></tr>
          </thead>
          <tbody>
            {orgs === null && <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Loading…</td></tr>}
            {orgs && shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">No organisations match.</td></tr>}
            {shown.map((o) => {
              const suspended = (o.memberCount ?? 0) > 0 && (o.activeMembers ?? 0) === 0;
              return (
                <tr key={o.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{o.name}</div>{o.division ? <div className="text-xs text-white/45">Division {o.division}</div> : null}</td>
                  <td className="px-4 py-3"><Link href={`/admin/users?org=${o.id}`} className="text-white/75 hover:text-white hover:underline">{o.activeMembers ?? 0} active{(o.memberCount ?? 0) !== (o.activeMembers ?? 0) ? ` of ${o.memberCount}` : ''}</Link></td>
                  <td className="px-4 py-3">{suspended ? <Pill tone="bad">Access suspended</Pill> : <Pill>{(o.certificationStatus ?? 'Draft').replace(/_/g, ' ').toLowerCase()}</Pill>}</td>
                  <td className="px-4 py-3 text-white/55">{ago(o.createdAt ?? o.created_at ?? null)}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" onClick={() => setOpen(o)}>Manage</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <ManageOrg org={open} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await load(); }} />}
    </AdminShell>
  );
}

function ManageOrg({ org, onClose, onDone }: { org: Org; onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(org.name);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const suspended = (org.memberCount ?? 0) > 0 && (org.activeMembers ?? 0) === 0;

  async function act(body: object, method: 'PATCH' | 'DELETE' = 'PATCH') {
    if (reason.trim().length < 3) { setMsg('Write a short reason first; it goes on the record.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch(`/api/v1/admin/organizations/${org.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, reason }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || 'That did not work.'); return; }
    await onDone();
  }

  return (
    <Panel title={org.name} onClose={onClose}>
      <Section title="Reason for the change" hint="Recorded with every change below.">
        <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client asked to pause their account" />
      </Section>
      <Section title="Name">
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={busy || name.trim() === org.name || name.trim().length < 2} onClick={() => act({ action: 'rename', name })}>Rename</Button>
      </Section>
      <Section title="Access" hint="Suspending signs out and blocks every person in this organisation. Restoring brings back exactly those people.">
        {suspended
          ? <Button disabled={busy} onClick={() => act({ action: 'restore' })}>Restore access</Button>
          : <Button disabled={busy || (org.activeMembers ?? 0) === 0} onClick={() => act({ action: 'suspend' })}>Suspend access</Button>}
      </Section>
      <Section title="Delete organisation" hint="Only possible once it has no people, certificates or AIC Aware badges. Everything filed under it is deleted. Cannot be undone.">
        <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type ${org.name} to confirm`} />
        <Button variant="danger" disabled={busy || confirm.trim() !== org.name} onClick={() => act({ confirmName: confirm }, 'DELETE')}>Delete organisation</Button>
      </Section>
      {msg && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{msg}</p>}
    </Panel>
  );
}
