'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Minus } from 'lucide-react';
import AdminShell from '@/app/components/admin/AdminShell';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { Button, Panel, Pill, Section, field, ROLE_LABEL } from '@/app/components/admin/ui';

/**
 * Permissions, as authorisation actually works (lib/rbac.ts): per-person
 * exceptions first, then the super admin switch, then the role matrix in
 * lib/capabilities.ts. Roles are read-only here because they live in code and
 * change through a reviewed release; exceptions are the one thing a super
 * admin changes on screen, and each needs a reason that goes on the record.
 */

type Cap = { slug: string; name: string; description: string; category: string };
type Matrix = { columns: { key: string; label: string }[]; rows: (Cap & { held: Record<string, boolean> })[] };
type Line = { slug: string; description: string; granted: boolean; because: string };
type Person = { id: string; name: string; email: string; role: string | null; isSuperAdmin: boolean; isActive: boolean; exceptions: { slug: string; name: string; effect: 'grant' | 'deny' }[]; access: Line[] };
type Entry = { id: string; action: string; actorName: string | null; targetName: string | null; capabilityName: string | null; reason: string | null; previous: string | null; createdAt: string };

const TABS = [['roles', 'What each role can do'], ['people', 'People'], ['log', 'Change log']] as const;
const when = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const tab = (on: boolean) => `h-10 border-b-2 px-3 text-sm font-medium ${on ? 'border-[#a8772a] text-[#0e1b2c]' : 'border-transparent text-[#5e6b7b] hover:text-[#0e1b2c]'}`;

function sentence(e: Entry) {
  const who = e.actorName ?? 'Someone';
  const whom = e.targetName ?? 'a person';
  const what = e.capabilityName ? `‘${e.capabilityName}’` : 'a capability';
  const verb = e.action === 'GRANT' ? `granted ${whom} ${what}` : e.action === 'DENY' ? `denied ${whom} ${what}` : e.action === 'CLEAR' ? `removed ${whom}’s exception for ${what}` : `${e.action.toLowerCase()} ${what} for ${whom}`;
  return `${who} ${verb}`;
}

export default function PermissionsPage() {
  const [view, setView] = useState<(typeof TABS)[number][0]>('roles');
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [caps, setCaps] = useState<Cap[]>([]);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [me, setMe] = useState('');
  const [log, setLog] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Person | null>(null);

  const load = useCallback(async () => {
    const [m, c, p, l] = await Promise.all(['roles', 'capabilities', 'people', 'log'].map((x) => fetch(`/api/v1/admin/rbac/${x}`, { cache: 'no-store' })));
    if (!m.ok) { setError((await m.json().catch(() => ({}))).error ?? 'Only a super admin can see permissions.'); return; }
    setMatrix(await m.json()); setCaps(await c.json());
    const pd = await p.json(); setPeople(pd.people); setMe(pd.me);
    setLog((await l.json()).entries);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (open && people) setOpen(people.find((p) => p.id === open.id) ?? null); }, [people]); // keep the panel in step after a change

  return (
    <AdminShell>
      <header className="mb-6">
        <Eyebrow>Administration</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Permissions</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[#5e6b7b]">What each staff role may do, who holds what and why, and every exception made for a named person.</p>
      </header>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!error && (
        <>
          <div className="mb-5 flex gap-1 border-b border-[#dde2e8]">{TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} className={tab(view === k)}>{l}</button>)}</div>

          {view === 'roles' && matrix && (
            <div className="space-y-4">
              <p className="max-w-3xl text-sm leading-relaxed text-[#5e6b7b]">Roles are set in the platform’s code and change only through a reviewed release, so the authorisation model can be shown to an assessor exactly as it runs. Separation of duties is built in: the person who assesses an organisation cannot also approve or issue its certificate. A super admin holds everything through the super admin switch, not through the role name.</p>
              <div className="overflow-x-auto rounded-xl border border-[#dde2e8] bg-white">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-[#dde2e8] text-xs text-[#8a95a3]">
                    <tr><th className="px-4 py-3 font-medium">Capability</th>{matrix.columns.map((c) => <th key={c.key} className="px-3 py-3 text-center font-medium">{c.label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((r) => (
                      <tr key={r.slug} className="border-b border-[#eef1f5] last:border-0">
                        <td className="px-4 py-3"><p className="font-medium text-[#0e1b2c]">{r.name}</p><p className="text-xs text-[#5e6b7b]">{r.description}</p></td>
                        {matrix.columns.map((c) => <td key={c.key} className="px-3 py-3 text-center">{r.held[c.key] ? <Check className="mx-auto h-4 w-4 text-[#2e7a57]" aria-label="Held" /> : <Minus className="mx-auto h-4 w-4 text-[#c9ced6]" aria-label="Not held" />}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'people' && people && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>An exception takes effect on the person’s next request. A denial beats everything else, including the super admin switch; use it to stop one person doing one thing without changing their role.</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#dde2e8] bg-white">
                {people.length === 0 && <p className="px-4 py-5 text-sm text-[#5e6b7b]">No AIC staff accounts yet.</p>}
                <ul className="divide-y divide-[#eef1f5]">
                  {people.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setOpen(p)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-[#f9fafb]">
                        <span className="min-w-[200px] flex-1"><span className="block font-medium text-[#0e1b2c]">{p.name}{p.id === me ? <span className="font-normal text-[#8a95a3]"> (you)</span> : null}</span><span className="block text-xs text-[#5e6b7b]">{p.email}</span></span>
                        <Pill tone={p.isSuperAdmin ? 'gold' : 'neutral'}>{p.isSuperAdmin ? 'Super admin' : ROLE_LABEL[p.role ?? ''] ?? p.role}</Pill>
                        {!p.isActive && <Pill tone="bad">Deactivated</Pill>}
                        <span className="text-xs text-[#5e6b7b]">{p.access.filter((a) => a.granted).length} of {p.access.length} capabilities</span>
                        <span className="text-xs text-[#8a95a3]">{p.exceptions.length ? `${p.exceptions.length} exception${p.exceptions.length === 1 ? '' : 's'}` : 'No exceptions'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {view === 'log' && log && (
            <div className="overflow-hidden rounded-xl border border-[#dde2e8] bg-white">
              {log.length === 0 && <p className="px-4 py-5 text-sm text-[#5e6b7b]">No permission has been changed yet. Every exception added or removed will appear here with its reason.</p>}
              <ul className="divide-y divide-[#eef1f5]">
                {log.map((e) => (
                  <li key={e.id} className="px-4 py-3 text-sm">
                    <p className="text-[#0e1b2c]">{sentence(e)} <span className="text-[#8a95a3]">on {when(e.createdAt)}</span></p>
                    {e.reason && <p className="mt-0.5 text-[#5e6b7b]">{e.reason}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {open && <PersonPanel person={open} caps={caps} isMe={open.id === me} onClose={() => setOpen(null)} onChanged={load} />}
    </AdminShell>
  );
}

function PersonPanel({ person, caps, isMe, onClose, onChanged }: { person: Person; caps: Cap[]; isMe: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [slug, setSlug] = useState('');
  const [effect, setEffect] = useState<'grant' | 'deny'>('grant');
  const [reason, setReason] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function send(method: 'POST' | 'DELETE', body: object) {
    setBusy(true); setMsg('');
    const r = await fetch('/api/v1/admin/rbac/exceptions', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: person.id, ...body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? 'Could not save.'); return; }
    setSlug(''); setReason(''); setRemoving(null);
    await onChanged();
  }

  return (
    <Panel title={person.name} onClose={onClose}>
      <Section title="What they can do, and why" hint="In the order the platform checks: exception, super admin switch, then role.">
        <ul className="space-y-1.5 text-sm">
          {person.access.map((a) => {
            const c = caps.find((x) => x.slug === a.slug);
            return (
              <li key={a.slug} className="flex items-start justify-between gap-3">
                <span className={a.granted ? 'text-[#0e1b2c]' : 'text-[#8a95a3]'}>{c?.name ?? a.slug}</span>
                <span className={`shrink-0 text-xs ${a.granted ? 'text-[#2e7a57]' : a.because.includes('denied') ? 'text-[#b23a35]' : 'text-[#8a95a3]'}`}>{a.granted ? 'Yes' : 'No'}, {a.because}</span>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Exceptions">
        {person.exceptions.length === 0 && <p className="text-sm text-[#5e6b7b]">None. This person has exactly what their role gives them.</p>}
        {person.exceptions.map((x) => (
          <div key={x.slug} className="rounded-lg border border-[#dde2e8] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#0e1b2c]">{x.effect === 'grant' ? 'Granted' : 'Denied'}: {x.name}</span>
              {!isMe && removing !== x.slug && <Button variant="ghost" onClick={() => { setRemoving(x.slug); setReason(''); }}>Remove</Button>}
            </div>
            {removing === x.slug && (
              <div className="mt-2 space-y-2">
                <textarea className={field} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is being removed (goes on the record)" />
                <div className="flex gap-2">
                  <Button variant="primary" disabled={busy || reason.trim().length < 10} onClick={() => send('DELETE', { capability: x.slug, reason })}>Remove exception</Button>
                  <Button variant="ghost" onClick={() => setRemoving(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </Section>
      <Section title="Add an exception" hint={isMe ? 'You cannot change your own access. Ask another super admin.' : 'For one named person, with a reason.'}>
        {!isMe && (
          <>
            <select className={field} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Capability">
              <option value="">Choose a capability</option>
              {caps.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <div className="flex gap-2">
              {(['grant', 'deny'] as const).map((e) => <Button key={e} variant={effect === e ? 'primary' : 'default'} onClick={() => setEffect(e)}>{e === 'grant' ? 'Grant it' : 'Deny it'}</Button>)}
            </div>
            <textarea className={field} rows={3} value={removing ? '' : reason} onChange={(e) => setReason(e.target.value)} placeholder="Why, in a sentence (goes on the record)" />
            <Button variant="primary" disabled={busy || !slug || reason.trim().length < 10} onClick={() => send('POST', { capability: slug, effect, reason })}>{busy ? 'Saving…' : effect === 'grant' ? 'Grant exception' : 'Deny exception'}</Button>
          </>
        )}
        {msg && <p className="text-sm text-[#b23a35]">{msg}</p>}
      </Section>
    </Panel>
  );
}
