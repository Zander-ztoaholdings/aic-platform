'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

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
      <Eyebrow>Register</Eyebrow>
      <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Organisations</h1>
      <p className="mt-1 text-sm text-[#5e6b7b]">Client organisations and their people. Suspend access, rename, or delete an empty organisation.</p>
      <input className={`${field} mt-6 max-w-sm`} placeholder="Search organisations" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#dde2e8]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f5f7f9] text-xs text-[#8a95a3]">
            <tr><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">People</th><th className="px-4 py-3 font-medium">Certification</th><th className="px-4 py-3 font-medium">Registered</th><th /></tr>
          </thead>
          <tbody>
            {orgs === null && <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8a95a3]">Loading…</td></tr>}
            {orgs && shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8a95a3]">No organisations match.</td></tr>}
            {shown.map((o) => {
              const suspended = (o.memberCount ?? 0) > 0 && (o.activeMembers ?? 0) === 0;
              return (
                <tr key={o.id} className="border-t border-[#dde2e8] hover:bg-[#eef1f5]">
                  <td className="px-4 py-3"><div className="font-medium text-[#0e1b2c]">{o.name}</div>{o.division ? <div className="text-xs text-[#8a95a3]">Division {o.division}</div> : null}</td>
                  <td className="px-4 py-3"><Link href={`/admin/users?org=${o.id}`} className="text-[#5e6b7b] hover:text-[#0e1b2c] hover:underline">{o.activeMembers ?? 0} active{(o.memberCount ?? 0) !== (o.activeMembers ?? 0) ? ` of ${o.memberCount}` : ''}</Link></td>
                  <td className="px-4 py-3">{suspended ? <Pill tone="bad">Access suspended</Pill> : <Pill>{(o.certificationStatus ?? 'Draft').replace(/_/g, ' ').toLowerCase()}</Pill>}</td>
                  <td className="px-4 py-3 text-[#5e6b7b]">{ago(o.createdAt ?? o.created_at ?? null)}</td>
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
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
    </Panel>
  );
}
