'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, AlertTriangle } from 'lucide-react';
import type { Approval } from '@/lib/agents/config';

export type SpForm = {
  kind: 'sharepoint'; name: string; description: string; tenantId: string | null; siteUrl: string; library: string; folder: string;
  access: 'read' | 'write'; approval: Approval; saved: boolean;
};
export type SpSetup = { configured: boolean; appId: string | null; knownTenant: string | null };
type Check = { ok: boolean; message: string; siteName?: string; libraryName?: string; siteId?: string; wider?: boolean; canWrite?: boolean | null };

export const blankSp = (tenantId: string | null): SpForm => ({ kind: 'sharepoint', name: '', description: '', tenantId, siteUrl: 'https://', library: 'Documents', folder: '', access: 'read', approval: 'writes', saved: false });

const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal text-[#0e1b2c] outline-none focus:border-[#a8772a] disabled:bg-[#f5f7f9]';
const radio = 'flex items-center gap-2 font-normal';

function sitePath(siteUrl: string): string {
  try { const u = new URL(siteUrl); return `${u.hostname}:${u.pathname.replace(/\/+$/, '')}`; } catch { return '{yourcompany}.sharepoint.com:/sites/{name}'; }
}

/** The steps the client's administrator follows to give AIC's agent app one site. */
function GrantSteps({ tool, appId }: { tool: SpForm; appId: string | null }) {
  const [open, setOpen] = useState(false);
  const body = JSON.stringify({ roles: [tool.access], grantedToIdentities: [{ application: { id: appId ?? '{AIC agent app id}', displayName: 'AIC Agents' } }] }, null, 2);
  return (
    <div className="rounded-xl border border-[#dde2e8] bg-[#f5f7f9] text-[13.5px] font-normal text-[#2b3a4d]">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-medium text-[#0e1b2c]">
        How your administrator gives AIC this site
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="list-decimal space-y-2.5 px-4 pb-4 pl-8">
          <li>Connect Microsoft 365 below. A global administrator approves AIC’s agent app with one permission, Sites.Selected, then signs in once so AIC can confirm which organisation approved it. Sites.Selected on its own opens no site at all.</li>
          <li>A SharePoint or global administrator opens Microsoft Graph Explorer, signs in, and consents to Sites.FullControl.All for Graph Explorer itself (this is their own sign-in, not AIC’s).</li>
          <li>Find the site’s id with a GET to:
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2.5 text-[12.5px]">https://graph.microsoft.com/v1.0/sites/{sitePath(tool.siteUrl)}?$select=id</pre>
          </li>
          <li>Grant AIC’s agent app {tool.access === 'write' ? 'read and write' : 'read'} access to that site only, with a POST to <span className="break-all">https://graph.microsoft.com/v1.0/sites/<em>site id</em>/permissions</span> and this body:
            <pre className="mt-1 overflow-x-auto rounded-lg bg-white p-2.5 text-[12.5px]">{body}</pre>
          </li>
          <li>Come back and press “Check access”. AIC confirms it can open the site and library, and warns you if it can see more than this one site.</li>
          <li>To take access away later, list the site’s permissions with a GET to the same address and DELETE the one for AIC Agents, or remove the app under Entra ID, Enterprise applications.</li>
        </ol>
      )}
    </div>
  );
}

export function SharePointTools({ agentId, tools, setTools, setup, edit, isAdmin, dirty, onSaveFirst }: {
  agentId: string; tools: SpForm[]; setTools: (t: SpForm[]) => void; setup: SpSetup; edit: boolean; isAdmin: boolean; dirty: boolean; onSaveFirst: () => Promise<boolean>;
}) {
  const [checks, setChecks] = useState<Record<string, Check | 'busy'>>({});
  const [err, setErr] = useState('');
  const set = (i: number, patch: Partial<SpForm>) => setTools(tools.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function connect() {
    setErr('');
    if (dirty && !(await onSaveFirst())) return;
    const r = await fetch('/api/agents/sharepoint/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? 'Could not start the connection.'); return; }
    window.location.href = j.url;
  }

  async function check(name: string) {
    setChecks((c) => ({ ...c, [name]: 'busy' }));
    const r = await fetch(`/api/agents/${agentId}/sharepoint-check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: name }) });
    const j = await r.json().catch(() => ({}));
    setChecks((c) => ({ ...c, [name]: r.ok ? j : { ok: false, message: j.error ?? 'Could not check.' } }));
  }

  if (!tools.length) return null;
  return (
    <>
      {tools.map((t, i) => {
        const c = checks[t.name];
        return (
          <div key={i} className="grid gap-4 rounded-2xl border border-[#dde2e8] bg-white p-5 text-[14px] font-medium text-[#0e1b2c] md:grid-cols-2">
            <p className="text-[12.5px] font-normal text-[#5e6b7b] md:col-span-2">SharePoint library</p>
            <label className="block">Tool name<input className={input} disabled={!edit} value={t.name} onChange={(e) => set(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="policies" /></label>
            <label className="block">Site address<input className={input} disabled={!edit} value={t.siteUrl} onChange={(e) => set(i, { siteUrl: e.target.value })} placeholder="https://yourcompany.sharepoint.com/sites/Policies" /></label>
            <label className="block md:col-span-2">What it is for<input className={input} disabled={!edit} value={t.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="The policy library: read policies to answer questions, and draft updates for review." /></label>
            <label className="block">Library<input className={input} disabled={!edit} value={t.library} onChange={(e) => set(i, { library: e.target.value })} placeholder="Documents" /></label>
            <label className="block">Keep it to this folder<input className={input} disabled={!edit} value={t.folder} onChange={(e) => set(i, { folder: e.target.value })} placeholder="Optional, like HR/Policies" /></label>
            <div>
              <p>Access</p>
              <div className="mt-1.5 space-y-1.5">
                <label className={radio}><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.access === 'read'} onChange={() => set(i, { access: 'read' })} />Read only</label>
                <label className={radio}><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.access === 'write'} onChange={() => set(i, { access: 'write' })} />Read, and write new files (Markdown, text, CSV)</label>
              </div>
            </div>
            <div>
              <p>Who approves writes</p>
              <div className="mt-1.5 space-y-1.5">
                <label className={radio}><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.approval !== 'never' && t.approval !== 'always'} onChange={() => set(i, { approval: 'writes' })} />A person approves every write</label>
                <label className={radio}><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.approval === 'always'} onChange={() => set(i, { approval: 'always' })} />A person approves every read and write</label>
                <label className={radio}><input type="radio" className="accent-[#0e1b2c]" disabled={!edit} checked={t.approval === 'never'} onChange={() => set(i, { approval: 'never' })} />Writes without asking</label>
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center gap-3 text-[13.5px] font-normal">
                {t.tenantId
                  ? <span className="inline-flex items-center gap-1.5 text-[#2e7a57]"><CheckCircle2 className="h-4 w-4" />Microsoft 365 connected</span>
                  : <span className="text-[#b45309]">Microsoft 365 not connected</span>}
                {!t.tenantId && edit && isAdmin && setup.configured && <button type="button" onClick={connect} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[14px] font-medium text-white hover:bg-[#22344a]">Connect Microsoft 365</button>}
                {!t.tenantId && !isAdmin && <span className="text-[#5e6b7b]">An organisation admin connects it.</span>}
                {t.tenantId && t.saved && <button type="button" disabled={c === 'busy'} onClick={() => check(t.name)} className="inline-flex h-10 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50">{c === 'busy' ? 'Checking…' : 'Check access'}</button>}
              </div>
              {!setup.configured && <p className="text-[13px] font-normal text-[#5e6b7b]">SharePoint for agents is not switched on for this AIC server yet.</p>}
              {c && c !== 'busy' && (
                <div className={`space-y-1 rounded-xl border p-3 text-[13.5px] font-normal ${c.ok ? 'border-[#2e7a57]/25 text-[#1f5a40]' : 'border-[#b23a35]/30 text-[#8f2d29]'}`}>
                  <p>{c.message}</p>
                  {c.ok && c.canWrite === null && t.access === 'write' && <p className="text-[#5e6b7b]">Microsoft does not let AIC see whether it was given read or write; the first write will tell.</p>}
                  {c.wider && <p className="flex gap-1.5 text-[#b23a35]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />AIC’s agent app can also open your tenant’s main site, so it was given more than this one site. Ask your administrator to remove any permission other than Sites.Selected.</p>}
                </div>
              )}
              <GrantSteps tool={t} appId={setup.appId} />
              {edit && <button type="button" onClick={() => setTools(tools.filter((_, j) => j !== i))} className="text-[13.5px] font-medium text-[#b23a35]">Remove this tool</button>}
            </div>
          </div>
        );
      })}
      {err && <p className="text-[13.5px] text-[#b23a35]">{err}</p>}
    </>
  );
}
