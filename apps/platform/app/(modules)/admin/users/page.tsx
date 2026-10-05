'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import { Button, Panel, Pill, Section, field, ROLE_LABEL, ago } from '@/app/components/admin/ui';

interface Person {
  id: string; name: string; email: string; role: string; orgId: string | null; orgName: string | null;
  isActive: boolean; isSuperAdmin: boolean; emailVerified: boolean; mfaEnabled: boolean;
  lockoutUntil: string | null; lastLogin: string | null; createdAt: string;
}
interface Org { id: string; name: string }

const ROLES = ['ORG_USER', 'ORG_ADMIN', 'AIC_AUDITOR', 'AIC_SUPER_ADMIN'];
const isStaff = (r: string) => r === 'AIC_SUPER_ADMIN' || r === 'AIC_AUDITOR';
const locked = (p: Person) => !!p.lockoutUntil && new Date(p.lockoutUntil) > new Date();

function PeoplePage() {
  const qs = useSearchParams();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [me, setMe] = useState('');
  const [canGrant, setCanGrant] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [roleF, setRoleF] = useState('');
  const [orgF, setOrgF] = useState(qs.get('org') ?? '');
  const [statusF, setStatusF] = useState('');
  const [open, setOpen] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [u, o] = await Promise.all([fetch('/api/v1/admin/users', { cache: 'no-store' }), fetch('/api/v1/admin/organizations', { cache: 'no-store' })]);
    const ud = await u.json().catch(() => ({}));
    if (!u.ok) { setError(ud.error || 'You do not have access to manage people.'); setPeople([]); return; }
    setPeople(ud.users); setMe(ud.me); setCanGrant(!!ud.canGrantSuperAdmin);
    const od = await o.json().catch(() => []);
    if (Array.isArray(od)) setOrgs(od.map((x: Org) => ({ id: x.id, name: x.name })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (people ?? []).filter((p) => {
    const s = q.trim().toLowerCase();
    if (s && !`${p.name} ${p.email} ${p.orgName ?? ''}`.toLowerCase().includes(s)) return false;
    if (roleF && (roleF === 'AIC_SUPER_ADMIN' ? !p.isSuperAdmin : p.role !== roleF || p.isSuperAdmin)) return false;
    if (orgF && p.orgId !== orgF) return false;
    if (statusF === 'active' && !p.isActive) return false;
    if (statusF === 'inactive' && p.isActive) return false;
    if (statusF === 'locked' && !locked(p)) return false;
    return true;
  }), [people, q, roleF, orgF, statusF]);

  return (
    <AdminShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Administration</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">People</h1>
          <p className="mt-1 text-sm text-[#5e6b7b]">Every account on the platform. Change roles, move people between organisations, and control access.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>Add an account</Button>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-4">
        <input className={field} placeholder="Search name, email or organisation" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={field} value={roleF} onChange={(e) => setRoleF(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r} className="text-black">{ROLE_LABEL[r]}</option>)}
        </select>
        <select className={field} value={orgF} onChange={(e) => setOrgF(e.target.value)}>
          <option value="">All organisations</option>
          {orgs.map((o) => <option key={o.id} value={o.id} className="text-black">{o.name}</option>)}
        </select>
        <select className={field} value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="">Any status</option>
          <option value="active" className="text-black">Active</option>
          <option value="inactive" className="text-black">Deactivated</option>
          <option value="locked" className="text-black">Locked out</option>
        </select>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#dde2e8]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[#f5f7f9] text-xs text-[#8a95a3]">
            <tr><th className="px-4 py-3 font-medium">Person</th><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Last sign-in</th><th /></tr>
          </thead>
          <tbody>
            {people === null && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a95a3]">Loading…</td></tr>}
            {people && shown.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8a95a3]">No one matches these filters.</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-[#dde2e8] hover:bg-[#eef1f5]">
                <td className="px-4 py-3"><div className="font-medium text-[#0e1b2c]">{p.name}{p.id === me && <span className="ml-2 text-xs text-[#8a95a3]">you</span>}</div><div className="text-xs text-[#8a95a3]">{p.email}</div></td>
                <td className="px-4 py-3 text-[#5e6b7b]">{p.orgName ?? <span className="text-[#8a95a3]">AIC</span>}</td>
                <td className="px-4 py-3"><Pill tone={p.isSuperAdmin ? 'gold' : 'neutral'}>{p.isSuperAdmin ? 'Super admin' : ROLE_LABEL[p.role] ?? p.role}</Pill></td>
                <td className="px-4 py-3 space-x-1">
                  {!p.isActive ? <Pill tone="bad">Deactivated</Pill> : locked(p) ? <Pill tone="warn">Locked out</Pill> : <Pill tone="good">Active</Pill>}
                  {!p.emailVerified && <Pill>Email unconfirmed</Pill>}
                </td>
                <td className="px-4 py-3 text-[#5e6b7b]">{ago(p.lastLogin)}</td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" onClick={() => setOpen(p)}>Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <ManagePerson person={open} orgs={orgs} isMe={open.id === me} canGrant={canGrant} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await load(); }} />}
      {creating && <CreatePerson orgs={orgs} canGrant={canGrant} onClose={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />}
    </AdminShell>
  );
}

function ManagePerson({ person, orgs, isMe, canGrant, onClose, onDone }: { person: Person; orgs: Org[]; isMe: boolean; canGrant: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [role, setRole] = useState(person.isSuperAdmin ? 'AIC_SUPER_ADMIN' : person.role);
  const [orgId, setOrgId] = useState(person.orgId ?? '');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function act(body: object, method: 'PATCH' | 'DELETE' = 'PATCH') {
    if (reason.trim().length < 3) { setMsg('Write a short reason first; it goes on the record.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch(`/api/v1/admin/users/${person.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, reason }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || 'That did not work.'); return; }
    await onDone();
  }

  const roleOptions = ROLES.filter((r) => r !== 'AIC_SUPER_ADMIN' || canGrant);

  return (
    <Panel title={person.name} onClose={onClose}>
      <p className="-mt-4 mb-5 text-sm text-[#8a95a3]">{person.email}</p>
      {isMe ? (
        <p className="text-sm text-[#5e6b7b]">This is your own account. Another super admin has to change your role or access, so nobody can lock themselves out by accident.</p>
      ) : (
        <>
          <Section title="Reason for the change" hint="Recorded with every change below, with your name and the time.">
            <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Took over as compliance lead" />
          </Section>

          <Section title="Role" hint="Takes effect within a minute, even if they are signed in.">
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r} className="text-black">{ROLE_LABEL[r]}</option>)}
            </select>
            <Button disabled={busy || role === (person.isSuperAdmin ? 'AIC_SUPER_ADMIN' : person.role)} onClick={() => act({ action: 'set_role', role })}>Change role</Button>
            {isStaff(role) && !isStaff(person.role) && <p className="text-xs text-amber-300/80">Staff roles leave their client organisation.</p>}
          </Section>

          {!isStaff(person.role) && (
            <Section title="Organisation">
              <select className={field} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                {orgs.map((o) => <option key={o.id} value={o.id} className="text-black">{o.name}</option>)}
              </select>
              <Button disabled={busy || orgId === (person.orgId ?? '')} onClick={() => act({ action: 'move_org', orgId })}>Move to this organisation</Button>
            </Section>
          )}

          <Section title="Access">
            <div className="flex flex-wrap gap-2">
              {person.isActive
                ? <Button disabled={busy} onClick={() => act({ action: 'deactivate' })}>Deactivate</Button>
                : <Button disabled={busy} onClick={() => act({ action: 'reactivate' })}>Reactivate</Button>}
              {locked(person) && <Button disabled={busy} onClick={() => act({ action: 'unlock' })}>Unlock sign-in</Button>}
            </div>
            <p className="text-xs text-[#8a95a3]">Deactivating signs them out within a minute and keeps everything they recorded.</p>
          </Section>

          <Section title="Remove account" hint="Erases their name, email and credentials for good. Their past records stay, attributed to a removed account. Cannot be undone.">
            <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type ${person.email} to confirm`} />
            <Button variant="danger" disabled={busy || confirm.trim().toLowerCase() !== person.email.toLowerCase()} onClick={() => act({ confirmEmail: confirm }, 'DELETE')}>Remove account</Button>
          </Section>
        </>
      )}
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
    </Panel>
  );
}

function CreatePerson({ orgs, canGrant, onClose, onDone }: { orgs: Org[]; canGrant: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'AIC_AUDITOR', orgId: orgs[0]?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const res = await fetch('/api/v1/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, orgId: isStaff(f.role) ? null : f.orgId }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || 'Could not create the account.'); return; }
    await onDone();
  }
  return (
    <Panel title="Add an account" onClose={onClose}>
      <p className="-mt-3 mb-5 text-sm text-[#8a95a3]">For AIC staff, mostly. Clients usually register themselves, or their admin invites them.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={field} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className={field} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className={field} type="password" placeholder="Temporary password, 12+ characters" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={12} />
        <select className={field} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {ROLES.filter((r) => r !== 'AIC_SUPER_ADMIN' || canGrant).map((r) => <option key={r} value={r} className="text-black">{ROLE_LABEL[r]}</option>)}
        </select>
        {!isStaff(f.role) && (
          <select className={field} value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })}>
            {orgs.map((o) => <option key={o.id} value={o.id} className="text-black">{o.name}</option>)}
          </select>
        )}
        {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
        <Button variant="primary" disabled={busy} type="submit" className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
      </form>
    </Panel>
  );
}

export default function Page() {
  return <Suspense fallback={null}><PeoplePage /></Suspense>;
}
