'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import { Eyebrow } from '@/app/components/ui/Eyebrow';
import { Portal } from '@/app/components/ui/Portal';
import { Button, Panel, Pill, Section, field, ago } from '@/app/components/admin/ui';

/**
 * Who leads and who reviews each organisation.
 *
 * Every organisation should have a lead (holds the file, does the assessment)
 * and, where AIC has a second auditor free of conflicts, a reviewer. The
 * default rule (lib/assignments.ts) fills empty seats; people with the right
 * to assign can change any seat, with a reason that goes on the record.
 * Someone who has declared a conflict with an organisation cannot be picked.
 */

type Seat = { id: string; name: string; since: string; reason: string } | null;
interface Org {
  id: string; name: string; division?: number | null; sector?: string | null; certificationStatus?: string | null; createdAt?: string | null;
  waiting: number; lead: Seat; reviewer: Seat; conflicted: string[];
}
interface Staff {
  id: string; name: string; email: string; role: string | null; isSuperAdmin: boolean; byDefault: boolean;
  leads: number; reviews: number; waiting: number; score: number;
}
interface History {
  id: string; orgId: string; orgName: string; userName: string; role: 'lead' | 'reviewer';
  assignedAt: string; assignedByName: string | null; reason: string;
  endedAt: string | null; endedByName: string | null; endReason: string | null;
}
interface Data { me: string; canAssign: boolean; organisations: Org[]; unassigned: number; staff: Staff[]; history: History[] }
type View = 'all' | 'unassigned' | 'noReviewer' | 'mine';

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const SEAT = { lead: 'lead', reviewer: 'reviewer' } as const;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default function AssignmentsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const [view, setView] = useState<View>('all');
  const [who, setWho] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Org | null>(null);
  const [bulk, setBulk] = useState<{ busy: boolean; msg: string; tone: 'good' | 'bad' } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/v1/admin/assignments', { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (d.notReady) setNotReady(true);
      else setError(d.error || 'You do not have access to assignments.');
      setData(null);
      return;
    }
    setData(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  const orgs = useMemo(() => data?.organisations ?? [], [data]);
  const counts = useMemo(() => ({
    all: orgs.length,
    unassigned: orgs.filter((o) => !o.lead).length,
    noReviewer: orgs.filter((o) => !o.reviewer).length,
    mine: orgs.filter((o) => o.lead?.id === data?.me || o.reviewer?.id === data?.me).length,
  }), [orgs, data]);
  const shown = useMemo(() => orgs
    .filter((o) => view === 'all' || (view === 'unassigned' ? !o.lead : view === 'noReviewer' ? !o.reviewer : o.lead?.id === data?.me || o.reviewer?.id === data?.me))
    .filter((o) => !who || o.lead?.id === who || o.reviewer?.id === who)
    .filter((o) => `${o.name} ${o.sector ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())), [orgs, view, who, q, data]);

  const empty = counts.unassigned + counts.noReviewer;
  const maxLoad = Math.max(1, ...(data?.staff ?? []).map((s) => s.leads + s.reviews));

  async function fillAll() {
    setBulk({ busy: true, msg: '', tone: 'good' });
    const res = await fetch('/api/v1/admin/assignments/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBulk({ busy: false, msg: d.error || 'That did not work.', tone: 'bad' }); return; }
    const failed = (d.failed ?? []).length;
    setBulk({
      busy: false, tone: failed ? 'bad' : 'good',
      msg: d.assigned ? `Filled ${plural(d.assigned, 'seat')}.${failed ? ` ${plural(failed, 'seat')} could not be filled.` : ''}` : 'Nothing to fill: there is no eligible auditor free of conflicts for the empty seats.',
    });
    await load();
  }

  return (
    <AdminShell>
      <Eyebrow>Assessments</Eyebrow>
      <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Assignments</h1>
      <p className="mt-1 max-w-2xl text-sm text-[#5e6b7b]">
        Who leads and who reviews each organisation. The lead holds the file and does the assessment; the reviewer is a second auditor, so no file is seen by one person only. Neither makes the certification decision.
      </p>

      {notReady && (
        <p className="mt-6 rounded-xl border border-[#dde2e8] bg-white px-4 py-3 text-sm text-[#5e6b7b]">
          Assignments are not switched on for this server yet (database migration 018). Until then, the register’s assessor column still works.
        </p>
      )}
      {error && <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#b23a35]">{error}</p>}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Organisations" value={counts.all} />
            <Tile label="Without a lead" value={counts.unassigned} tone={counts.unassigned ? 'warn' : 'ink'} />
            <Tile label="Without a reviewer" value={counts.noReviewer} tone={counts.noReviewer ? 'warn' : 'ink'} />
            <Tile label="Yours" value={counts.mine} />
          </div>

          {data.canAssign && (
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#dde2e8] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#5e6b7b]">
                The default rule picks, for each empty seat, the active auditor with no declared conflict who has the fewest organisations and least evidence waiting. Super admins are never picked by default.
              </p>
              <Button variant="primary" className="shrink-0" disabled={!!bulk?.busy || empty === 0} onClick={fillAll}>
                {bulk?.busy ? 'Assigning…' : 'Assign everyone unassigned by the default rule'}
              </Button>
            </div>
          )}
          {bulk?.msg && <p className={`mt-2 text-sm ${bulk.tone === 'good' ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>{bulk.msg}</p>}

          <section className="mt-6 rounded-xl border border-[#dde2e8] bg-white p-4 sm:p-5" aria-labelledby="load">
            <h2 id="load" className="text-[15px] font-semibold text-[#0e1b2c]">Load per auditor</h2>
            <p className="mt-0.5 text-xs text-[#5e6b7b]">Organisations led and reviewed now, and evidence waiting in the ones they lead.</p>
            {data.staff.length === 0 ? (
              <p className="mt-3 text-sm text-[#8a95a3]">There are no active AIC auditors yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {[...data.staff].sort((a, b) => b.leads + b.reviews - (a.leads + a.reviews) || a.name.localeCompare(b.name, 'en-GB')).map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setWho(who === s.id ? '' : s.id)} className="block w-full text-left" aria-pressed={who === s.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                        <span className={`font-medium ${who === s.id ? 'text-[#8a6a1f]' : 'text-[#0e1b2c]'}`}>
                          {s.name}{s.id === data.me ? ' (you)' : ''}
                          {!s.byDefault && <span className="ml-2 font-normal text-[#8a95a3]">{s.isSuperAdmin ? 'super admin, by hand only' : 'by hand only'}</span>}
                        </span>
                        <span className="text-[#5e6b7b]">{s.leads} leading, {s.reviews} reviewing, {plural(s.waiting, 'document')} waiting</span>
                      </div>
                      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
                        <span className="h-1.5 bg-[#0e1b2c]" style={{ width: `${(s.leads / maxLoad) * 100}%` }} />
                        <span className="h-1.5 bg-[#a8772a]" style={{ width: `${(s.reviews / maxLoad) * 100}%` }} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-[#5e6b7b]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0e1b2c]" />Leading</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#a8772a]" />Reviewing</span>
              <span>Select a person to see only their organisations.</span>
            </p>
          </section>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex max-w-full overflow-x-auto rounded-full border border-[#dde2e8] bg-white p-1">
              {([['all', 'Everyone'], ['unassigned', 'No lead'], ['noReviewer', 'No reviewer'], ['mine', 'Mine']] as [View, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className={`h-9 shrink-0 rounded-full px-3 text-sm font-medium sm:px-4 ${view === k ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>
                  {l} <span className="opacity-60">{counts[k]}</span>
                </button>
              ))}
            </div>
            <select className={`${field} lg:max-w-[220px]`} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Auditor">
              <option value="">Any auditor</option>
              {data.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input className={`${field} lg:max-w-xs`} placeholder="Search name or sector" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {/* Phones: one card per organisation. */}
          <ul className="mt-4 space-y-2 md:hidden">
            {shown.length === 0 && <li className="rounded-xl border border-[#dde2e8] bg-white px-4 py-8 text-center text-sm text-[#8a95a3]">No organisations match.</li>}
            {shown.map((o) => (
              <li key={o.id} className="rounded-xl border border-[#dde2e8] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-[#0e1b2c]">{o.name}</div>
                    <div className="text-xs text-[#8a95a3]">{o.waiting > 0 ? `${plural(o.waiting, 'document')} waiting` : 'Nothing waiting'}</div>
                  </div>
                  {data.canAssign && <Button className="shrink-0" onClick={() => setOpen(o)}>Change</Button>}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-xs text-[#8a95a3]">Lead</dt><dd><SeatName seat={o.lead} me={data.me} /></dd></div>
                  <div><dt className="text-xs text-[#8a95a3]">Reviewer</dt><dd><SeatName seat={o.reviewer} me={data.me} /></dd></div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-4 hidden overflow-hidden rounded-xl border border-[#dde2e8] bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f5f7f9] text-xs text-[#5e6b7b]">
                <tr><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">Lead</th><th className="px-4 py-3 font-medium">Reviewer</th><th className="px-4 py-3 font-medium">Waiting</th><th /></tr>
              </thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[#8a95a3]">No organisations match.</td></tr>}
                {shown.map((o) => (
                  <tr key={o.id} className="border-t border-[#dde2e8] align-top hover:bg-[#f8f9fb]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0e1b2c]">{o.name}</div>
                      <div className="text-xs text-[#8a95a3]">{[o.division ? `Division ${o.division}` : null, o.sector].filter(Boolean).join(', ') || 'Profile not completed'}</div>
                    </td>
                    <td className="px-4 py-3"><SeatName seat={o.lead} me={data.me} />{o.lead && <div className="text-xs text-[#8a95a3]">assigned {lowerFirst(ago(o.lead.since))}</div>}</td>
                    <td className="px-4 py-3"><SeatName seat={o.reviewer} me={data.me} />{o.reviewer && <div className="text-xs text-[#8a95a3]">assigned {lowerFirst(ago(o.reviewer.since))}</div>}</td>
                    <td className="px-4 py-3 text-[#5e6b7b]">{o.waiting > 0 ? <span className="text-[#8a6a1f]">{plural(o.waiting, 'document')}</span> : 'None'}</td>
                    <td className="px-4 py-3 text-right">{data.canAssign && <Button variant="ghost" onClick={() => setOpen(o)}>Change</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="mt-8" aria-labelledby="history">
            <h2 id="history" className="text-[15px] font-semibold text-[#0e1b2c]">Recent changes</h2>
            <HistoryList rows={data.history} showOrg />
          </section>
        </>
      )}

      {open && data && (
        <Portal>
          <ChangeSeats org={open} staff={data.staff} onClose={() => setOpen(null)} onDone={async () => { setOpen(null); await load(); }} />
        </Portal>
      )}
    </AdminShell>
  );
}

function Tile({ label, value, tone = 'ink' }: { label: string; value: number; tone?: 'ink' | 'warn' }) {
  return (
    <div className="rounded-xl border border-[#dde2e8] bg-white p-4">
      <div className="text-[12.5px] font-medium text-[#5e6b7b]">{label}</div>
      <div className={`mt-1 font-serif text-[26px] font-semibold tabular-nums ${tone === 'warn' ? 'text-[#b45309]' : 'text-[#0e1b2c]'}`}>{value.toLocaleString('en-GB')}</div>
    </div>
  );
}

function SeatName({ seat, me }: { seat: Seat; me: string }) {
  if (!seat) return <span className="text-[#b45309]">Nobody</span>;
  if (seat.id === me) return <Pill tone="gold">You</Pill>;
  return <span className="text-[#0e1b2c]">{seat.name}</span>;
}

function HistoryList({ rows, showOrg = false }: { rows: History[]; showOrg?: boolean }) {
  if (!rows.length) return <p className="mt-2 text-sm text-[#8a95a3]">No changes recorded yet.</p>;
  return (
    <ul className="mt-2 divide-y divide-[#eef1f5] rounded-xl border border-[#dde2e8] bg-white">
      {rows.map((h) => (
        <li key={h.id} className="px-4 py-3 text-sm">
          <div className="text-[#0e1b2c]">
            <span className="font-medium">{h.userName}</span> {h.endedAt ? 'stopped being' : 'became'} {SEAT[h.role]}{showOrg ? <> for <span className="font-medium">{h.orgName}</span></> : null}
          </div>
          <div className="mt-0.5 text-xs text-[#5e6b7b]">
            {h.endedAt
              ? `${ago(h.endedAt)}, by ${h.endedByName ?? 'the system'}. ${h.endReason ?? ''}`
              : `${ago(h.assignedAt)}, by ${h.assignedByName ?? 'the system'}. ${h.reason}`}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChangeSeats({ org, staff, onClose, onDone }: { org: Org; staff: Staff[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [lead, setLead] = useState(org.lead?.id ?? '');
  const [reviewer, setReviewer] = useState(org.reviewer?.id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<History[] | null>(null);
  const conflicted = new Set(org.conflicted);

  useEffect(() => {
    let live = true;
    fetch(`/api/v1/admin/assignments?historyFor=${org.id}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (live) setHistory(d.history ?? []); }).catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [org.id]);

  async function send(method: 'POST' | 'DELETE', body: object, url = '/api/v1/admin/assignments') {
    const byHand = url === '/api/v1/admin/assignments';
    if (byHand && reason.trim().length < 3) { setMsg('Write a short reason first; it goes on the record.'); return; }
    if (!byHand && reason.trim().length > 0 && reason.trim().length < 3) { setMsg('Make the reason a little longer, or leave it empty.'); return; }
    setBusy(true); setMsg('');
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: org.id, ...body, ...(reason.trim() ? { reason: reason.trim() } : {}) }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || 'That did not work.'); return; }
    await onDone();
  }

  const option = (s: Staff, other: string) => {
    const why = conflicted.has(s.id) ? ' (declared a conflict)' : s.id === other ? ' (holds the other seat)' : '';
    return <option key={s.id} value={s.id} disabled={!!why}>{s.name}{s.isSuperAdmin ? ', super admin' : ''}{why}</option>;
  };

  return (
    <Panel title={org.name} onClose={onClose}>
      <Section title="Reason for the change" hint="Required. Recorded with every change below.">
        <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Balancing work after a new auditor joined" />
      </Section>
      <Section title="Lead" hint="Holds the file and does the assessment. The evidence screens open for this person.">
        <select className={field} value={lead} onChange={(e) => setLead(e.target.value)} aria-label="Lead">
          <option value="">Nobody</option>
          {staff.map((s) => option(s, org.reviewer?.id ?? ''))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy || !lead || lead === (org.lead?.id ?? '')} onClick={() => send('POST', { userId: lead, role: 'lead' })}>Save lead</Button>
          {org.lead && <Button variant="ghost" disabled={busy} onClick={() => send('DELETE', { role: 'lead' })}>Remove lead</Button>}
        </div>
      </Section>
      <Section title="Reviewer" hint="A second auditor who checks the lead’s work. Must be a different person.">
        <select className={field} value={reviewer} onChange={(e) => setReviewer(e.target.value)} aria-label="Reviewer">
          <option value="">Nobody</option>
          {staff.map((s) => option(s, org.lead?.id ?? ''))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy || !reviewer || reviewer === (org.reviewer?.id ?? '')} onClick={() => send('POST', { userId: reviewer, role: 'reviewer' })}>Save reviewer</Button>
          {org.reviewer && <Button variant="ghost" disabled={busy} onClick={() => send('DELETE', { role: 'reviewer' })}>Remove reviewer</Button>}
        </div>
      </Section>
      {(!org.lead || !org.reviewer) && (
        <Section title="Use the default rule" hint="Fills the empty seats with the least busy auditor free of conflicts.">
          <Button disabled={busy} onClick={() => send('POST', {}, '/api/v1/admin/assignments/auto')}>Fill empty seats by the default rule</Button>
        </Section>
      )}
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#b23a35]">{msg}</p>}
      <Section title="History">
        {history === null ? <p className="text-sm text-[#8a95a3]">Loading…</p> : <HistoryList rows={history} />}
      </Section>
    </Panel>
  );
}
