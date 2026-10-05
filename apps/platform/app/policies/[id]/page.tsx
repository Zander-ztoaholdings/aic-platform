'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { PolicyText } from '../../components/ui/PolicyText';
import { PracticeForPolicy } from '../../components/PracticeForPolicy';

type Data = {
  canManage: boolean;
  policy: { id: string; title: string; body: string; publishedVersion: number; reviewDueAt: string | null; controls: string[]; hasUnpublishedChanges: boolean };
  current: { version: number; title: string; body: string; bodyHash: string; publishedAt: string; publishedBy: string | null } | null;
  versions: { version: number; publishedAt: string; publishedBy: string | null; bodyHash: string }[];
  members: { id: string; name: string; acceptedAt: string | null; isMe: boolean }[];
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function PolicyDetail() {
  const { id } = useParams<{ id: string }>();
  const startEditing = useSearchParams().get('edit') === '1';
  const [d, setD] = useState<Data | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/policies/${id}`, { cache: 'no-store' });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(b.error || 'Could not load the policy.'); return; }
    setD(b);
    setTitle(b.policy.title);
    setBody(b.policy.body);
    setReview(b.policy.reviewDueAt ? b.policy.reviewDueAt.slice(0, 10) : '');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (startEditing && d?.canManage) setEditing(true); }, [startEditing, d?.canManage]);

  async function send(url: string, method: string, payload?: unknown) {
    setBusy(true); setErr(''); setMsg('');
    const r = await fetch(url, { method, headers: payload ? { 'Content-Type': 'application/json' } : undefined, body: payload ? JSON.stringify(payload) : undefined });
    const b = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(b.error || 'That did not work. Try again.'); return null; }
    return b;
  }
  async function save() {
    if (await send(`/api/policies/${id}`, 'PATCH', { title, body, reviewDueAt: review || null })) { setEditing(false); setMsg('Saved. Publish it when it is ready for people to accept.'); load(); }
  }
  async function publish() {
    if (!confirm('Publish this as the next version? Everyone will be asked to accept it again.')) return;
    const b = await send(`/api/policies/${id}/publish`, 'POST');
    if (b) { setMsg(`Version ${b.version} is published.`); load(); }
  }
  async function accept() {
    const b = await send(`/api/policies/${id}/accept`, 'POST');
    if (b) { setMsg(`You accepted version ${b.version}.`); load(); }
  }

  if (!d) return <p className="text-[14px] text-[#5e6b7b]">{err || 'Loading…'}</p>;
  const me = d.members.find((m) => m.isMe);
  const accepted = d.members.filter((m) => m.acceptedAt).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
      <article className="min-w-0 space-y-5">
        <div>
          <Eyebrow><Link href="/policies" className="hover:underline">Policies</Link></Eyebrow>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${d.policy.publishedVersion ? 'text-[#2e7a57] bg-[#2e7a57]/10' : 'text-[#5e6b7b] bg-[#f5f7f9]'}`}>
              {d.policy.publishedVersion ? `Version ${d.policy.publishedVersion} in force` : 'Draft'}
            </span>
            {d.policy.hasUnpublishedChanges && d.policy.publishedVersion > 0 && <span className="text-[12.5px] text-[#8a6a1f]">Edited since it was published</span>}
          </div>
        </div>
        {msg && <div className="rounded-xl border border-[#dde2e8] bg-white px-4 py-3 text-[14px] text-[#0e1b2c]">{msg}</div>}
        {err && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{err}</div>}

        {editing ? (
          <div className="bg-white border border-[#dde2e8] rounded-xl p-4 sm:p-5 space-y-3">
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-[#dde2e8] px-3 h-11 text-[15px] outline-none focus:border-[#a8772a]" />
            </label>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Text
              <span className="block text-[12.5px] font-normal text-[#5e6b7b]">“# ” for the title, “## ” for a section, “- ” for a bullet. Anything still in [square brackets] must be replaced before publishing.</span>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={24} className="mt-1 w-full rounded-lg border border-[#dde2e8] px-3 py-2 text-[14px] leading-relaxed font-mono outline-none focus:border-[#a8772a]" />
            </label>
            <label className="block text-[13px] font-medium text-[#0e1b2c]">Next review due
              <input type="date" value={review} onChange={(e) => setReview(e.target.value)} className="mt-1 block rounded-lg border border-[#dde2e8] px-3 h-11 text-[15px] outline-none focus:border-[#a8772a]" />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={save} disabled={busy} className="h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-50">Save draft</button>
              <button onClick={() => { setEditing(false); setTitle(d.policy.title); setBody(d.policy.body); }} className="h-11 sm:h-10 px-4 rounded-full text-[14px] font-medium text-[#5e6b7b]">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#dde2e8] rounded-xl p-5 sm:p-8">
            <PolicyText text={d.policy.publishedVersion && !d.canManage && d.current ? d.current.body : d.policy.body} />
          </div>
        )}

        {!editing && (
          <div className="flex flex-col sm:flex-row gap-2">
            {d.policy.publishedVersion > 0 && me && !me.acceptedAt && (
              <button onClick={accept} disabled={busy} className="h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-50">
                I have read and accept version {d.policy.publishedVersion}
              </button>
            )}
            {d.canManage && <button onClick={() => setEditing(true)} className="h-11 sm:h-10 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Edit</button>}
            {d.canManage && d.policy.hasUnpublishedChanges && (
              <button onClick={publish} disabled={busy} className="h-11 sm:h-10 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50">
                Publish as version {d.policy.publishedVersion + 1}
              </button>
            )}
          </div>
        )}
      </article>

      <aside className="space-y-4">
        {d.policy.publishedVersion > 0 && <PracticeForPolicy policyId={d.policy.id} />}
        {d.policy.publishedVersion > 0 && (
          <div className="bg-white border border-[#dde2e8] rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Accepted by {accepted} of {d.members.length}</h2>
            <ul className="mt-2 space-y-1.5">
              {d.members.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 text-[13px]">
                  <span className="text-[#0e1b2c] truncate">{m.name}{m.isMe ? ' (you)' : ''}</span>
                  <span className={m.acceptedAt ? 'text-[#2e7a57]' : 'text-[#8a95a3]'}>{m.acceptedAt ? fmt(m.acceptedAt) : 'Not yet'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.versions.length > 0 && (
          <div className="bg-white border border-[#dde2e8] rounded-xl p-5">
            <h2 className="text-[14px] font-semibold text-[#0e1b2c]">Published versions</h2>
            <ul className="mt-2 space-y-1.5 text-[13px] text-[#5e6b7b]">
              {d.versions.map((v) => (
                <li key={v.version}>Version {v.version}, {fmt(v.publishedAt)}{v.publishedBy ? ` by ${v.publishedBy}` : ''}<span className="block text-[11.5px] text-[#8a95a3] break-all">Fingerprint {v.bodyHash.slice(0, 16)}</span></li>
              ))}
            </ul>
          </div>
        )}
        {d.policy.controls.length > 0 && <p className="text-[12.5px] text-[#8a95a3]">Evidence towards {d.policy.controls.join(', ')}.</p>}
      </aside>
    </div>
  );
}

export default function PolicyPage() {
  return (
    <DashboardShell>
      <Suspense>
        <PolicyDetail />
      </Suspense>
    </DashboardShell>
  );
}
