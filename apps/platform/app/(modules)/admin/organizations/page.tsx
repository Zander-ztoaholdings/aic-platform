'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/app/components/admin/AdminShell';
import { Button, Panel, Pill, Section, field, ago } from '@/app/components/admin/ui';

/**
 * The register. Every assessor sees who has registered, so a new client is
 * never invisible; opening a file's evidence is for the assessor who holds it,
 * after a conflict declaration. Super admins assign files and manage access.
 */

interface Org {
  id: string; name: string; legalName?: string | null; division?: number | null; sector?: string | null; sizeBand?: string | null;
  certificationStatus?: string | null; contactEmail?: string | null;
  memberCount?: number; activeMembers?: number; createdAt?: string | null; created_at?: string | null; signupCompletedAt?: string | null;
  auditorId?: string | null; auditorName?: string | null; assignedToMe?: boolean; waitingEvidence?: number; lastActive?: string | null;
  lead?: { id: string; name: string } | null; reviewer?: { id: string; name: string } | null; reviewerIsMe?: boolean;
}
type Assessor = { id: string; name: string; email: string; role: string };
type View = 'mine' | 'unassigned' | 'all';

export default function OrganisationsPage() {
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [staff, setStaff] = useState<{ assessors: Assessor[]; me: string; isSuperAdmin: boolean } | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('all');
  const [open, setOpen] = useState<Org | null>(null);
  const [claiming, setClaiming] = useState<Org | null>(null);

  const load = useCallback(async () => {
    const [res, st] = await Promise.all([fetch('/api/v1/admin/organizations', { cache: 'no-store' }), fetch('/api/v1/admin/assessors', { cache: 'no-store' })]);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || 'You do not have access to the register.'); setOrgs([]); return; }
    setOrgs(d);
    if (st.ok) setStaff(await st.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    mine: (orgs ?? []).filter((o) => o.assignedToMe || o.reviewerIsMe).length,
    unassigned: (orgs ?? []).filter((o) => !o.auditorId).length,
    all: (orgs ?? []).length,
  }), [orgs]);
  const shown = useMemo(() => (orgs ?? [])
    .filter((o) => view === 'all' || (view === 'mine' ? o.assignedToMe || o.reviewerIsMe : !o.auditorId))
    .filter((o) => `${o.name} ${o.legalName ?? ''} ${o.sector ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())), [orgs, q, view]);

  return (
    <AdminShell>
      <Eyebrow>Register</Eyebrow>
      <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Organisations</h1>
      <p className="mt-1 max-w-2xl text-sm text-[#5e6b7b]">Everyone registered with AIC. Take an unassigned file to start helping a client; you declare any conflict of interest first, and the declaration is kept.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-full border border-[#dde2e8] bg-white p-1">
          {([['all', 'Everyone'], ['unassigned', 'Unassigned'], ['mine', 'My files']] as [View, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={`h-9 rounded-full px-4 text-sm font-medium ${view === k ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{l} <span className="opacity-60">{counts[k]}</span></button>
          ))}
        </div>
        <input className={`${field} sm:max-w-xs`} placeholder="Search name or sector" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#dde2e8] bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-[#f5f7f9] text-xs text-[#8a95a3]">
            <tr><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">People</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Lead and reviewer</th><th className="px-4 py-3 font-medium">Registered</th><th /></tr>
          </thead>
          <tbody>
            {orgs === null && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a95a3]">Loading…</td></tr>}
            {orgs && shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a95a3]">{view === 'mine' ? 'No files are assigned to you yet. Take one from Unassigned.' : 'No organisations match.'}</td></tr>}
            {shown.map((o) => {
              const suspended = (o.memberCount ?? 0) > 0 && (o.activeMembers ?? 0) === 0;
              return (
                <tr key={o.id} className="border-t border-[#dde2e8] align-top hover:bg-[#f8f9fb]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0e1b2c]">{o.name}</div>
                    <div className="text-xs text-[#8a95a3]">{[o.division ? `Division ${o.division}` : null, o.sector, o.sizeBand].filter(Boolean).join(', ') || 'Profile not completed'}</div>
                  </td>
                  <td className="px-4 py-3 text-[#5e6b7b]">
                    {staff?.isSuperAdmin ? <Link href={`/admin/users?org=${o.id}`} className="hover:text-[#0e1b2c] hover:underline">{o.activeMembers ?? 0} active</Link> : <span>{o.activeMembers ?? 0} active</span>}
                    <div className="text-xs text-[#8a95a3]">{o.lastActive ? `last seen ${ago(o.lastActive)}` : 'never signed in'}</div>
                  </td>
                  <td className="px-4 py-3">
                    {suspended ? <Pill tone="bad">Access suspended</Pill> : <Pill>{(o.certificationStatus ?? 'Draft').replace(/_/g, ' ').toLowerCase()}</Pill>}
                    {(o.waitingEvidence ?? 0) > 0 && <div className="mt-1 text-xs text-[#8a6a1f]">{o.waitingEvidence} file{o.waitingEvidence === 1 ? '' : 's'} waiting for review</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{o.assignedToMe ? <Pill tone="gold">You</Pill> : (o.lead?.name ?? o.auditorName) ? <span className="text-[#0e1b2c]">{o.lead?.name ?? o.auditorName}</span> : <span className="text-[#8a95a3]">Unassigned</span>}</div>
                    <div className="mt-0.5 text-xs text-[#8a95a3]">{o.reviewerIsMe ? 'Reviewer: you' : o.reviewer ? `Reviewer: ${o.reviewer.name}` : 'No reviewer'}</div>
                  </td>
                  <td className="px-4 py-3 text-[#5e6b7b]">{ago(o.createdAt ?? o.created_at ?? null)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {o.assignedToMe && <Link href={`/admin/verification?org=${o.id}`} className="mr-2 text-sm font-medium text-[#8a6a1f] hover:underline">Open file</Link>}
                    {!o.auditorId && <Button onClick={() => setClaiming(o)}>Take file</Button>}
                    {staff?.isSuperAdmin && <Button variant="ghost" onClick={() => setOpen(o)}>Manage</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {claiming && <ClaimFile org={claiming} onClose={() => setClaiming(null)} onDone={async () => { setClaiming(null); await load(); }} />}
      {open && <ManageOrg org={open} assessors={staff?.assessors ?? []} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await load(); }} />}
    </AdminShell>
  );
}

function ClaimFile({ org, onClose, onDone }: { org: Org; onClose: () => void; onDone: () => Promise<void> }) {
  const [prior, setPrior] = useState<boolean | null>(null);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function send() {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/v1/admin/organizations/${org.id}/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priorAdvisory: !!prior, lastAdvisoryDate: prior && date ? date : null, declaration: note || undefined }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || 'That did not work.'); return; }
    await onDone();
  }
  return (
    <Panel title={`Take ${org.name}`} onClose={onClose}>
      <Section title="Conflict of interest" hint="Have you, or a business you are part of, advised, consulted for, or worked for this organisation?">
        <div className="flex gap-2">
          <Button variant={prior === false ? 'primary' : 'default'} onClick={() => setPrior(false)}>No</Button>
          <Button variant={prior === true ? 'primary' : 'default'} onClick={() => setPrior(true)}>Yes</Button>
        </div>
        {prior && (
          <label className="mt-3 block text-sm text-[#5e6b7b]">When did that work end?
            <input type="date" className={`${field} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
      </Section>
      <Section title="Anything else to declare" hint="Optional. Kept with the declaration.">
        <input className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. A former colleague works there; no involvement in AI" />
      </Section>
      <Button variant="primary" disabled={busy || prior === null} onClick={send}>Declare and take the file</Button>
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
    </Panel>
  );
}

function ManageOrg({ org, assessors, onClose, onDone }: { org: Org; assessors: Assessor[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [assessor, setAssessor] = useState(org.auditorId ?? '');
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
      <Section title="Assessor" hint="The assessor still declares any conflict before opening the file.">
        <select className={field} value={assessor} onChange={(e) => setAssessor(e.target.value)}>
          <option value="">Unassigned</option>
          {assessors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
        </select>
        <Button disabled={busy || assessor === (org.auditorId ?? '')} onClick={() => act({ action: 'assign', auditorId: assessor || null })}>Save assessor</Button>
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
