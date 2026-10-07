'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2 } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';

/**
 * One project: its tasks on the left, and on the right the people on it, the
 * frameworks it must meet (with the organisation's coverage of each) and the
 * AI systems in scope. Everything saves as it is changed.
 */

type Coverage = { total: number; evidenced: number; partial: number; gap: number; noEvidence: number; notMapped: number };
type Task = { id: string; title: string; detail: string | null; assigneeId: string | null; dueDate: string | null; status: 'todo' | 'doing' | 'done'; frameworkKey: string | null };
type Data = {
  project: { id: string; name: string; description: string | null; status: 'active' | 'paused' | 'done'; leadId: string | null; dueDate: string | null };
  members: { userId: string; role: 'lead' | 'contributor' | 'reviewer'; name: string; email: string }[];
  people: { id: string; name: string; email: string }[];
  frameworks: { key: string; name: string; note: string; on: boolean; coverage: Coverage }[];
  untracked: string[];
  systems: { id: string; name: string; on: boolean }[];
  tasks: Task[];
  canEdit: boolean; canDelete: boolean;
};

const ROLE: Record<string, string> = { lead: 'Lead', contributor: 'Contributor', reviewer: 'Reviewer' };
const STATUS_WORD = { todo: 'To do', doing: 'Doing', done: 'Done' } as const;
const date = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const box = 'h-10 rounded-xl border border-[#dde2e8] bg-white px-3 text-[14px] outline-none focus:border-[#a8772a]';
const field = 'h-10 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[14px] outline-none focus:border-[#a8772a]';
const card = 'rounded-2xl border border-[#dde2e8] bg-white';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not load the project.'); return; }
    setD(await r.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(body: Record<string, unknown>) {
    setSaving(true); setErr('');
    const r = await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not save.'); return; }
    load();
  }
  async function taskCall(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, taskId?: string) {
    setErr('');
    const r = await fetch(`/api/projects/${id}/tasks${taskId ? `/${taskId}` : ''}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? 'Could not save the task.'); return false; }
    load();
    return true;
  }

  if (!d) return <DashboardShell><p className="text-[14px] text-[#5e6b7b]">{err || 'Loading…'}</p></DashboardShell>;
  const { project: p, canEdit } = d;
  const on = d.frameworks.filter((f) => f.on);
  const memberIds = new Set(d.members.map((m) => m.userId));
  const setMembers = (list: { userId: string; role: string }[]) => patch({ members: list });

  return (
    <DashboardShell>
      <div className="max-w-[1200px] space-y-6">
        <div>
          <Link href="/projects" className="text-[13px] font-medium text-[#8a6114] hover:underline">All projects</Link>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              {canEdit ? (
                <input defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && patch({ name: e.target.value })} aria-label="Project name"
                  className="w-full rounded-lg bg-transparent font-serif text-[30px] font-semibold leading-tight text-[#0e1b2c] outline-none focus:bg-white focus:ring-2 focus:ring-[#a8772a]/30 md:text-[34px]" />
              ) : <h1 className="font-serif text-[30px] font-semibold leading-tight text-[#0e1b2c] md:text-[34px]">{p.name}</h1>}
              {canEdit ? (
                <textarea defaultValue={p.description ?? ''} rows={2} placeholder="What this project is, and why it has obligations of its own" onBlur={(e) => e.target.value !== (p.description ?? '') && patch({ description: e.target.value })}
                  className="mt-1 w-full resize-none rounded-lg bg-transparent text-[15px] leading-relaxed text-[#5e6b7b] outline-none focus:bg-white focus:ring-2 focus:ring-[#a8772a]/30" />
              ) : p.description && <p className="mt-1 text-[15px] text-[#5e6b7b]">{p.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select disabled={!canEdit} value={p.status} onChange={(e) => patch({ status: e.target.value })} className={box} aria-label="Status">
                <option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option>
              </select>
              <label className="flex items-center gap-2 text-[13px] text-[#5e6b7b]">Due
                <input type="date" disabled={!canEdit} defaultValue={p.dueDate ?? ''} onBlur={(e) => e.target.value !== (p.dueDate ?? '') && patch({ dueDate: e.target.value || null })} className={box} />
              </label>
              {d.canDelete && (
                <button type="button" onClick={async () => { if (confirm(`Delete "${p.name}" and its tasks? Evidence and the continuity record are not affected.`)) { const r = await fetch(`/api/projects/${id}`, { method: 'DELETE' }); if (r.ok) router.push('/projects'); } }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-[#b23a35] hover:bg-[#b23a35]/5"><Trash2 className="h-4 w-4" /> Delete</button>
              )}
            </div>
          </div>
          {(err || saving) && <p role="status" className={`mt-2 text-[13px] ${err ? 'text-[#b23a35]' : 'text-[#5e6b7b]'}`}>{err || 'Saving…'}</p>}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Tasks d={d} canEdit={canEdit} call={taskCall} frameworks={on} />

          <aside className="space-y-6">
            <section className={`${card} p-5`}>
              <h2 className="text-[16px] font-semibold text-[#0e1b2c]">People</h2>
              <ul className="mt-3 divide-y divide-[#eef1f5]">
                {d.members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0"><span className="block truncate text-[14px] text-[#0e1b2c]">{m.name}</span><span className="block truncate text-[12.5px] text-[#8a95a3]">{m.email}</span></span>
                    {canEdit ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <select value={m.role} onChange={(e) => setMembers(d.members.map((x) => ({ userId: x.userId, role: x.userId === m.userId ? e.target.value : x.role })))} className="h-9 rounded-lg border border-[#dde2e8] bg-white px-2 text-[13px]" aria-label={`${m.name}'s role`}>
                          {Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        <button type="button" onClick={() => setMembers(d.members.filter((x) => x.userId !== m.userId))} className="flex h-9 w-9 items-center justify-center rounded-full text-[#8a95a3] hover:bg-[#eef1f5] hover:text-[#b23a35]" aria-label={`Take ${m.name} off the project`}>×</button>
                      </span>
                    ) : <span className="text-[13px] text-[#5e6b7b]">{ROLE[m.role]}</span>}
                  </li>
                ))}
                {d.members.length === 0 && <li className="py-2 text-[13.5px] text-[#5e6b7b]">Nobody yet.</li>}
              </ul>
              {canEdit && d.people.some((u) => !memberIds.has(u.id)) && (
                <select value="" onChange={(e) => e.target.value && setMembers([...d.members.map((x) => ({ userId: x.userId, role: x.role })), { userId: e.target.value, role: 'contributor' }])} className={`${field} mt-2`} aria-label="Add someone">
                  <option value="">Add someone from your team…</option>
                  {d.people.filter((u) => !memberIds.has(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </section>

            <section className={`${card} p-5`}>
              <h2 className="text-[16px] font-semibold text-[#0e1b2c]">Frameworks</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-[#5e6b7b]">Switch on the ones this project must meet. Coverage is your organisation&apos;s, since evidence counts once.</p>
              <ul className="mt-3 space-y-2">
                {d.frameworks.map((f) => {
                  const pct = f.coverage.total ? Math.round((f.coverage.evidenced / f.coverage.total) * 100) : 0;
                  return (
                    <li key={f.key}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${f.on ? 'border-[#a8772a]/50 bg-[#fbf7ee]' : 'border-[#dde2e8]'} ${canEdit ? '' : 'cursor-default'}`}>
                        <input type="checkbox" disabled={!canEdit} checked={f.on} onChange={() => patch({ frameworks: d.frameworks.filter((x) => (x.key === f.key ? !x.on : x.on)).map((x) => x.key).concat(d.untracked) })} className="mt-1 accent-[#a8772a]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-medium text-[#0e1b2c]">{f.name}</span>
                          {f.on && <>
                            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[#eef1f5]"><span className="block h-full rounded-full bg-[#2e7a57]" style={{ width: `${pct}%` }} /></span>
                            <span className="mt-1 block text-[12px] text-[#5e6b7b]">{f.coverage.evidenced} of {f.coverage.total} evidenced{f.coverage.gap ? `, ${f.coverage.gap} ${f.coverage.gap === 1 ? 'gap' : 'gaps'}` : ''}</span>
                          </>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {d.untracked.length > 0 && <p className="mt-2 text-[12.5px] text-[#8a4a10]">{d.untracked.length} framework{d.untracked.length === 1 ? '' : 's'} on this project {d.untracked.length === 1 ? 'is' : 'are'} no longer tracked by your organisation.</p>}
              <Link href="/frameworks" className="mt-3 inline-block text-[13px] font-medium text-[#8a6114] hover:underline">Track more frameworks</Link>
            </section>

            <section className={`${card} p-5`}>
              <h2 className="text-[16px] font-semibold text-[#0e1b2c]">AI systems in scope</h2>
              {d.systems.length === 0 ? (
                <p className="mt-1 text-[13.5px] text-[#5e6b7b]">No AI systems declared yet. <Link href="/overview" className="font-medium text-[#8a6114] hover:underline">Declare one</Link></p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {d.systems.map((s) => (
                    <li key={s.id}>
                      <label className="flex items-center gap-3 text-[14px] text-[#0e1b2c]">
                        <input type="checkbox" disabled={!canEdit} checked={s.on} onChange={() => patch({ systems: d.systems.filter((x) => (x.id === s.id ? !x.on : x.on)).map((x) => x.id) })} className="accent-[#a8772a]" />
                        {s.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function Tasks({ d, canEdit, call, frameworks }: { d: Data; canEdit: boolean; call: (m: 'POST' | 'PATCH' | 'DELETE', b?: Record<string, unknown>, id?: string) => Promise<boolean>; frameworks: Data['frameworks'] }) {
  const [f, setF] = useState({ title: '', assigneeId: '', dueDate: '', frameworkKey: '' });
  const [show, setShow] = useState<'open' | 'all'>('open');
  const people = useMemo(() => new Map(d.people.map((u) => [u.id, u.name])), [d.people]);
  const fwName = useMemo(() => new Map(d.frameworks.map((x) => [x.key, x.name])), [d.frameworks]);
  const today = new Date().toISOString().slice(0, 10);
  const groups = (['doing', 'todo', 'done'] as const).filter((s) => show === 'all' || s !== 'done');
  const assignable = d.members.length ? d.members.map((m) => ({ id: m.userId, name: m.name })) : d.people;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call('POST', { title: f.title, assigneeId: f.assigneeId || null, dueDate: f.dueDate || null, frameworkKey: f.frameworkKey || null })) setF({ title: '', assigneeId: f.assigneeId, dueDate: '', frameworkKey: f.frameworkKey });
  }

  return (
    <section className={`${card}`}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#eef1f5] px-5 py-4">
        <div>
          <h2 className="text-[18px] font-semibold text-[#0e1b2c]">Tasks</h2>
          <p className="text-[13px] text-[#5e6b7b]">{d.tasks.filter((t) => t.status === 'done').length} of {d.tasks.length} done</p>
        </div>
        <button type="button" onClick={() => setShow(show === 'open' ? 'all' : 'open')} className="text-[13px] font-medium text-[#8a6114] hover:underline">{show === 'open' ? 'Show done' : 'Hide done'}</button>
      </header>

      {canEdit && (
        <form onSubmit={add} className="grid gap-2 border-b border-[#eef1f5] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_10rem] lg:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem_auto]">
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What needs doing" aria-label="Task" className={field} />
          <select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} aria-label="For" className={field}>
            <option value="">Unassigned</option>{assignable.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} aria-label="Due" className={field} />
          <select value={f.frameworkKey} onChange={(e) => setF({ ...f, frameworkKey: e.target.value })} aria-label="Framework" className={field}>
            <option value="">No framework</option>{frameworks.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
          <button type="submit" disabled={f.title.trim().length < 2} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#0e1b2c] px-4 text-[14px] font-semibold text-white hover:bg-[#22344a] disabled:opacity-40"><Plus className="h-4 w-4" /> Add</button>
        </form>
      )}

      {d.tasks.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-[#5e6b7b]">No tasks yet. Add what has to happen for this project to meet its frameworks, and who is doing it.</p>
      ) : groups.map((s) => {
        const list = d.tasks.filter((t) => t.status === s);
        if (!list.length) return null;
        return (
          <div key={s}>
            <p className="bg-[#f5f7f9] px-5 py-1.5 text-[12.5px] font-medium text-[#5e6b7b]">{STATUS_WORD[s]} ({list.length})</p>
            <ul className="divide-y divide-[#eef1f5]">
              {list.map((t) => {
                const late = t.status !== 'done' && t.dueDate && t.dueDate < today;
                return (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                    <button type="button" disabled={!canEdit} onClick={() => call('PATCH', { status: t.status === 'done' ? 'todo' : 'done' }, t.id)} aria-label={t.status === 'done' ? 'Mark not done' : 'Mark done'}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${t.status === 'done' ? 'border-[#2e7a57] bg-[#2e7a57] text-white' : 'border-[#c9ced6] hover:border-[#2e7a57]'}`}>
                      {t.status === 'done' && <Check className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14.5px] ${t.status === 'done' ? 'text-[#8a95a3] line-through' : 'text-[#0e1b2c]'}`}>{t.title}</p>
                      <p className="mt-0.5 text-[12.5px] text-[#5e6b7b]">
                        {[t.assigneeId ? people.get(t.assigneeId) ?? 'Former member' : 'Unassigned', t.dueDate ? `due ${date(t.dueDate)}` : null, t.frameworkKey ? fwName.get(t.frameworkKey) ?? t.frameworkKey : null].filter(Boolean).join(', ')}
                        {late && <span className="font-medium text-[#b23a35]"> (overdue)</span>}
                      </p>
                    </div>
                    {canEdit && (
                      <span className="flex shrink-0 items-center gap-1">
                        {t.status !== 'done' && (
                          <button type="button" onClick={() => call('PATCH', { status: t.status === 'doing' ? 'todo' : 'doing' }, t.id)} className="h-8 rounded-full border border-[#dde2e8] px-2.5 text-[12.5px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">
                            {t.status === 'doing' ? 'Back to to do' : 'Start'}
                          </button>
                        )}
                        <button type="button" onClick={() => call('DELETE', undefined, t.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a95a3] hover:bg-[#eef1f5] hover:text-[#b23a35]" aria-label="Remove task"><Trash2 className="h-4 w-4" /></button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
