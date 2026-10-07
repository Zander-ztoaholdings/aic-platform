'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Github, Copy, Check, RefreshCw, ExternalLink, KeyRound, Terminal } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '../components/ui/PageHeader';
import { ConnectorCatalogue } from './ConnectorCatalogue';
import { useIntegrations, call, ago, type Integration, type IntegrationsData } from './useIntegrations';
import { VendorLogo } from '../components/ui/VendorLogo';
import { AiUseSection, AiUseNotes } from './AiUse';

/**
 * Connected systems.
 *
 * A register of what AIC has been given access to, how, and what it read last.
 * Laid out as one ruled list rather than a grid of tiles: it is a record of
 * access, and someone reviewing it (an insurer, an auditor, the client's own
 * security lead) reads it top to bottom.
 */

type Source = 'github' | 'microsoft' | 'openai' | 'anthropic';

const SOURCES: { key: Source; name: string; reads: string }[] = [
  {
    key: 'github',
    name: 'GitHub',
    reads: 'Branch rules, merged pull requests and their reviews, Dependabot and secret-scanning alerts, which repositories depend on AI libraries, and who holds a GitHub Copilot seat and last used it.',
  },
  {
    key: 'microsoft',
    name: 'Microsoft 365',
    reads: 'Whether a second factor is required and registered, who the global administrators are, and which accounts have gone unused, and who uses Microsoft 365 Copilot in which apps. Never mail, files or chats.',
  },
  {
    key: 'openai',
    name: 'OpenAI',
    reads: 'Daily usage and cost per model for your organisation. Never prompts, outputs or files.',
  },
  {
    key: 'anthropic',
    name: 'Anthropic',
    reads: 'Daily usage and cost per model for your organisation and, when AIC holds an admin key, who uses Claude Code and how much. Never prompts, outputs or files. Claude Enterprise seats are under More systems.',
  },
];

const KEY_HELP: Record<'openai' | 'anthropic', { where: string; prefix: string }> = {
  openai: { where: 'OpenAI → Organisation settings → Admin keys', prefix: 'sk-admin-' },
  anthropic: { where: 'Claude Console → Settings → Admin keys', prefix: 'sk-ant-admin' },
};

function stateOf(i: Integration | undefined): { label: string; tone: string } {
  if (!i) return { label: 'Not connected', tone: 'text-[#5e6b7b] bg-[#f5f7f9]' };
  if (i.status === 'active') return { label: 'Connected', tone: 'text-[#2e7a57] bg-[#2e7a57]/10' };
  if (i.status === 'pending') return { label: i.mode === 'exporter' ? 'Waiting for first data' : 'Checking', tone: 'text-[#8a6a1f] bg-[#a8772a]/10' };
  if (i.status === 'error') return { label: 'Needs attention', tone: 'text-[#b45309] bg-[#b45309]/10' };
  return { label: 'Access withdrawn', tone: 'text-[#b23a35] bg-[#b23a35]/10' };
}

export default function IntegrationsPageRoute() {
  return (
    <Suspense>
      <IntegrationsPage />
    </Suspense>
  );
}

function IntegrationsPage() {
  const { data, error, reload } = useIntegrations();
  const params = useSearchParams();
  const [open, setOpen] = useState<Source | null>(null);
  const [notice, setNotice] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const c = params.get('connected');
    const e = params.get('error');
    if (c === 'github') setNotice('GitHub is connected. AIC is reading your repositories now; checks appear in a minute or two.');
    else if (c === 'microsoft') setNotice('Microsoft 365 is connected. AIC is reading your tenant now; checks appear in a minute or two.');
    else if (params.get('microsoft') === 'declined') setNotice('Microsoft did not grant AIC access. Only a global administrator of the tenant can approve it.');
    else if (params.get('microsoft') === 'wrongtenant') setNotice('The person who signed in is not a member of the Microsoft 365 organisation that approved AIC, so AIC did not connect it. Sign in with an account from that organisation.');
    else if (params.get('microsoft') === 'taken') setNotice('That Microsoft 365 tenant is already connected to another organisation on AIC, so it was not connected here. If that is a mistake, contact AIC.');
    else if (e === 'microsoft') setNotice('Microsoft 365 could not be connected. Microsoft did not confirm AIC’s access to that tenant; try again from the start.');
    else if (e === 'permission') setNotice('Only an organisation administrator can connect systems.');
    else if (params.get('github') === 'requested') setNotice('GitHub sent your request to an owner of the GitHub organisation. Once they approve it, come back and connect again.');
    else if (e === 'state') setNotice('That connection link expired or belonged to another session. Start the connection again.');
    else if (e) setNotice('GitHub could not be connected. Try again, and check you installed the AIC app rather than a different one.');
  }, [params]);

  // While anything is still being read, look again shortly.
  useEffect(() => {
    if (!data?.integrations.some((i) => i.status === 'pending')) return;
    const t = setTimeout(reload, 8000);
    return () => clearTimeout(t);
  }, [data, reload]);

  const byProvider = (p: Source) => data?.integrations.find((i) => i.provider === p);
  const failing = data?.checks.filter((c) => c.status === 'fail').length ?? 0;

  async function syncNow() {
    setSyncing(true);
    const r = await call('/api/integrations/sync', 'POST');
    setSyncing(false);
    setNotice(r.ok ? 'Checked again just now.' : r.error!);
    reload();
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Compliance tracking"
          title="Connected systems"
          lede="Connect the systems where your AI is built and run, and the ones your people sign in to. AIC reads them every night, runs its checks, and records any change of verdict in your continuity record."
        />

        {notice && (
          <div className="rounded-xl border border-[#dde2e8] bg-white px-4 py-3 text-[14px] text-[#0e1b2c] flex items-start justify-between gap-4">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} className="text-[#5e6b7b] hover:text-[#0e1b2c] text-[13px] shrink-0">Dismiss</button>
          </div>
        )}
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}

        {/* What access means, before anyone grants it. */}
        <section className="grid sm:grid-cols-2 gap-px bg-[#dde2e8] rounded-xl overflow-hidden border border-[#dde2e8]">
          <div className="bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#0e1b2c]">What AIC can do with access</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e6b7b]">Read settings, reviews, alerts and usage totals, once a night or when you ask.</p>
          </div>
          <div className="bg-white p-5">
            <h2 className="text-[14px] font-semibold text-[#0e1b2c]">What it cannot do</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[#5e6b7b]">Change code or settings, call a model, or see prompts, outputs or customer data.</p>
          </div>
        </section>

        <section data-tour="setup-connect" className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee]">
          {SOURCES.map((s) => {
            const i = byProvider(s.key);
            const st = stateOf(i);
            const isOpen = open === s.key;
            return (
              <div key={s.key} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
                  <VendorLogo id={s.key} name={s.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-[16px] font-semibold text-[#0e1b2c]">{s.name}</h2>
                      <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${st.tone}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#5e6b7b]">{s.reads}</p>
                    {i && <ConnectionFacts i={i} />}
                    {i && data && <AiUseNotes i={i} checks={data.checks.filter((c) => c.provider === s.key)} />}
                  </div>
                  {data?.canManage && (
                    <div className="flex gap-2 shrink-0">
                      {!i || i.status === 'disconnected' ? (
                        <button
                          onClick={() => setOpen(isOpen ? null : s.key)}
                          className="h-11 sm:h-9 px-4 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] w-full sm:w-auto"
                        >
                          {isOpen ? 'Cancel' : i ? 'Reconnect' : 'Connect'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setOpen(isOpen ? null : s.key)}
                          className="h-11 sm:h-9 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] w-full sm:w-auto"
                        >
                          {isOpen ? 'Close' : 'Manage'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isOpen && data && (
                  <div className="mt-5 pt-5 border-t border-[#e6e9ee]">
                    {s.key === 'github' ? (
                      <GitHubPanel data={data} i={i} onDone={(m) => { setOpen(null); if (m) setNotice(m); reload(); }} />
                    ) : s.key === 'microsoft' ? (
                      <MicrosoftPanel data={data} i={i} onDone={(m) => { setOpen(null); if (m) setNotice(m); reload(); }} />
                    ) : (
                      <ProviderPanel provider={s.key} i={i} onDone={(m) => { setOpen(null); if (m) setNotice(m); reload(); }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {data && data.integrations.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[14px] text-[#5e6b7b]">
              {failing === 0 ? 'No checks are failing.' : `${failing} check${failing === 1 ? ' is' : 's are'} failing.`}{' '}
              <Link href="/checks" className="font-medium text-[#8a6a1f] hover:underline">See every check</Link>
            </p>
            <button
              onClick={syncNow}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-2 h-11 sm:h-9 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a] disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Checking…' : 'Check now'}
            </button>
          </div>
        )}

        {data && <AiUseSection canManage={data.canManage} onNotice={setNotice} refreshKey={data.integrations.reduce((n, i) => n + (i.lastSyncedAt ? Date.parse(i.lastSyncedAt) : 0), 0)} />}

        {data && (
          <ConnectorCatalogue integrations={data.integrations} checks={data.checks} canManage={data.canManage} proven={data.proven} onChanged={(m) => { setNotice(m); reload(); }} />
        )}
      </div>
    </DashboardShell>
  );
}

function ConnectionFacts({ i }: { i: Integration }) {
  const facts: string[] = [];
  if (i.provider === 'microsoft') {
    const tn = i.settings.tenantName as string | undefined;
    facts.push(tn ? `Tenant ${tn}` : 'Tenant connected');
    if (typeof i.settings.users === 'number') facts.push(`${i.settings.users} accounts`);
  } else if (i.provider === 'github') {
    if (i.accountLabel) facts.push(`Installed on ${i.accountLabel}`);
    if (typeof i.settings.repositoriesTotal === 'number') {
      const n = i.settings.repositoriesTotal;
      const scanned = i.settings.repositories?.length ?? n;
      facts.push(scanned < n ? `${scanned} of ${n} repositories checked` : `${n} repositor${n === 1 ? 'y' : 'ies'}`);
    }
  } else {
    facts.push(i.mode === 'api_key' ? `AIC pulls with a stored read-only key ${i.secretHint ?? ''}`.trim() : 'You send usage with the exporter; AIC holds no key');
  }
  facts.push(`Last checked ${ago(i.lastSyncedAt)}`);
  return (
    <div className="mt-2 space-y-1">
      <p className="text-[13px] text-[#5e6b7b]">{facts.join('. ')}.</p>
      {i.lastError && <p className="text-[13px] text-[#b45309]">{i.lastError}</p>}
    </div>
  );
}

function GitHubPanel({ data, i, onDone }: { data: IntegrationsData; i?: Integration; onDone: (msg?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function connect() {
    setBusy(true);
    setErr('');
    const r = await call('/api/integrations/github/connect', 'POST');
    if (!r.ok) { setErr(r.error!); setBusy(false); return; }
    window.location.href = r.data!.url as string;
  }

  async function disconnect() {
    if (!confirm('Disconnect GitHub? AIC stops checking your repositories. You should also uninstall the AIC app on GitHub.')) return;
    setBusy(true);
    const r = await call('/api/integrations/github', 'DELETE');
    setBusy(false);
    if (!r.ok) { setErr(r.error!); return; }
    onDone('GitHub is disconnected. To remove AIC’s access completely, uninstall the AIC app in GitHub → Settings → Applications.');
  }

  if (i && i.status !== 'disconnected') {
    const manageUrl = !i.externalId
      ? 'https://github.com/settings/installations'
      : i.settings.accountType === 'Organization' && i.accountLabel
        ? `https://github.com/organizations/${i.accountLabel}/settings/installations/${i.externalId}`
        : `https://github.com/settings/installations/${i.externalId}`;
    return (
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-[#5e6b7b]">
          To change which repositories AIC can read, or to remove it, use GitHub’s own settings. AIC picks up the change on the next check.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <a href={manageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 h-11 sm:h-9 px-4 rounded-full border border-[#d5dbe2] text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">
            Choose repositories on GitHub <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button onClick={disconnect} disabled={busy} className="h-11 sm:h-9 px-4 rounded-full text-[14px] font-medium text-[#b23a35] hover:bg-[#b23a35]/5 disabled:opacity-50">
            Disconnect
          </button>
        </div>
        {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-[14px] leading-relaxed text-[#0e1b2c] list-decimal pl-5">
        <li>GitHub asks where to install the AIC app. Pick your organisation, then <strong className="font-semibold">only the repositories that hold AI systems or production code</strong>. You can add more later.</li>
        <li>GitHub shows the permissions. Every one is read-only.</li>
        <li>You come back here, and the first checks run straight away.</li>
      </ol>
      {!data.githubAppConfigured && (
        <p className="text-[13px] text-[#b45309]">GitHub connections are not switched on for this AIC server yet.</p>
      )}
      <button
        onClick={connect}
        disabled={busy || !data.githubAppConfigured}
        className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-40 w-full sm:w-auto"
      >
        <Github className="w-4 h-4" /> {busy ? 'Opening GitHub…' : 'Continue to GitHub'}
      </button>
      {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
    </div>
  );
}

function MicrosoftPanel({ data, i, onDone }: { data: IntegrationsData; i?: Integration; onDone: (msg?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function connect() {
    setBusy(true);
    setErr('');
    const r = await call('/api/integrations/microsoft/connect', 'POST');
    if (!r.ok) { setErr(r.error!); setBusy(false); return; }
    window.location.href = r.data!.url as string;
  }

  async function disconnect() {
    if (!confirm('Disconnect Microsoft 365? AIC stops checking your tenant. To remove its access completely, also delete the AIC app under Entra ID → Enterprise applications.')) return;
    setBusy(true);
    const r = await call('/api/integrations/microsoft', 'DELETE');
    setBusy(false);
    if (!r.ok) { setErr(r.error!); return; }
    onDone('Microsoft 365 is disconnected. To remove AIC’s access completely, delete the AIC app under Entra ID → Enterprise applications.');
  }

  if (i && i.status !== 'disconnected') {
    return (
      <div className="space-y-4">
        <p className="text-[14px] leading-relaxed text-[#5e6b7b]">
          AIC holds only your tenant id. To remove its access, delete the AIC app under Entra ID → Enterprise applications; AIC notices on the next check.
        </p>
        <button onClick={disconnect} disabled={busy} className="h-11 sm:h-9 px-4 rounded-full text-[14px] font-medium text-[#b23a35] hover:bg-[#b23a35]/5 disabled:opacity-50">
          Disconnect
        </button>
        {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-[14px] leading-relaxed text-[#0e1b2c] list-decimal pl-5">
        <li>A <strong className="font-semibold">global administrator</strong> of your Microsoft 365 tenant needs to do this step.</li>
        <li>Microsoft shows the permissions AIC asks for. Every one is read-only: users, sign-in policies, admin roles, sign-in reports and usage reports (for Copilot).</li>
        <li>You come back here, and the first checks run straight away. Two of them need an Entra ID P1 or P2 licence; without one they show “could not check”.</li>
      </ol>
      {!data.microsoftConfigured && <p className="text-[13px] text-[#b45309]">Microsoft 365 connections are not switched on for this AIC server yet.</p>}
      <button
        onClick={connect}
        disabled={busy || !data.microsoftConfigured}
        className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-40 w-full sm:w-auto"
      >
        {busy ? 'Opening Microsoft…' : 'Continue to Microsoft'}
      </button>
      {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
    </div>
  );
}

function workflowYaml(origin: string, provider: 'openai' | 'anthropic') {
  const keyVar = provider === 'openai' ? 'OPENAI_ADMIN_KEY' : 'ANTHROPIC_ADMIN_KEY';
  return `# Sends the last three days of ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} usage totals to AIC every night.
# Your provider key stays in your GitHub secrets; AIC never receives it.
name: AIC usage export
on:
  schedule:
    - cron: '17 2 * * *'
  workflow_dispatch:
jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      # tools/aic-usage-exporter.mjs is the file from
      # ${origin}/exporter/aic-usage-exporter.mjs, committed to your repo
      # so you run the code you reviewed.
      - run: node tools/aic-usage-exporter.mjs
        env:
          AIC_API_KEY: \${{ secrets.AIC_API_KEY }}
          ${keyVar}: \${{ secrets.${keyVar} }}
          AIC_URL: ${origin}
`;
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-[#0e1b2c] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-[12.5px] text-white/60">.github/workflows/aic-usage.yml</span>
        <button
          onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12.5px] px-2.5 py-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto text-[#e6e9ee] text-[12.5px] leading-relaxed p-4">{text}</pre>
    </div>
  );
}

function ProviderPanel({ provider, i, onDone }: { provider: 'openai' | 'anthropic'; i?: Integration; onDone: (msg?: string) => void }) {
  const label = provider === 'openai' ? 'OpenAI' : 'Anthropic';
  const [mode, setMode] = useState<'exporter' | 'api_key'>(i?.mode === 'api_key' ? 'api_key' : 'exporter');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const origin = typeof window === 'undefined' ? 'https://app.aiccertified.cloud' : window.location.origin;
  const live = i && i.status !== 'disconnected';

  async function save() {
    setBusy(true);
    setErr('');
    const r = await call(`/api/integrations/${provider}`, 'POST', mode === 'api_key' ? { mode, key } : { mode });
    setBusy(false);
    if (!r.ok) { setErr(r.error!); return; }
    setKey('');
    onDone(
      mode === 'api_key'
        ? `${label} is connected. AIC checked the key, stored it encrypted, and read your recent usage.`
        : `${label} is set up for the exporter. It shows as connected once the first usage arrives.`
    );
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${label}? ${i?.mode === 'api_key' ? 'The stored key is deleted. ' : ''}Usage already recorded stays in your record.`)) return;
    setBusy(true);
    const r = await call(`/api/integrations/${provider}`, 'DELETE');
    setBusy(false);
    if (!r.ok) { setErr(r.error!); return; }
    onDone(`${label} is disconnected.${i?.mode === 'api_key' ? ' AIC deleted the stored key; you can also revoke it with ' + label + '.' : ''}`);
  }

  const option = (value: 'exporter' | 'api_key', title: string, body: string, Icon: typeof Terminal) => (
    <label className={`flex gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${mode === value ? 'border-[#a8772a] bg-[#fbf7ee]' : 'border-[#dde2e8] hover:border-[#c9ced6]'}`}>
      <input type="radio" name={`mode-${provider}`} checked={mode === value} onChange={() => setMode(value)} className="mt-1 accent-[#a8772a]" />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[#0e1b2c]"><Icon className="w-4 h-4 text-[#8a6a1f]" /> {title}</span>
        <span className="block mt-1 text-[13.5px] leading-relaxed text-[#5e6b7b]">{body}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {option('exporter', 'Run the exporter (recommended)', `A small script runs on your side with your own ${label} admin key and sends AIC daily totals. AIC never holds the key.`, Terminal)}
        {option('api_key', 'Give AIC a read-only key', `Paste a ${label} admin key. AIC stores it encrypted, uses it only to read usage, and deletes it when you disconnect.`, KeyRound)}
      </div>

      {mode === 'exporter' ? (
        <div className="space-y-3">
          <ol className="space-y-2 text-[14px] leading-relaxed text-[#0e1b2c] list-decimal pl-5">
            <li>
              Create an AIC key under <Link href="/settings/keys" className="font-medium text-[#8a6a1f] hover:underline">API &amp; access keys</Link>.
            </li>
            <li>
              Download <a href="/exporter/aic-usage-exporter.mjs" className="font-medium text-[#8a6a1f] hover:underline" download>the exporter</a>, read it, and commit it to a repository as <code className="text-[13px] bg-[#f5f7f9] px-1 rounded">tools/aic-usage-exporter.mjs</code>.
            </li>
            <li>
              Add two repository secrets: <code className="text-[13px] bg-[#f5f7f9] px-1 rounded">AIC_API_KEY</code> and <code className="text-[13px] bg-[#f5f7f9] px-1 rounded">{provider === 'openai' ? 'OPENAI_ADMIN_KEY' : 'ANTHROPIC_ADMIN_KEY'}</code> (from {KEY_HELP[provider].where}).
            </li>
            <li>Add this workflow. It runs every night; run it once by hand to check.</li>
          </ol>
          <CopyBlock text={workflowYaml(origin, provider)} />
          <p className="text-[13px] text-[#5e6b7b]">
            Not on GitHub? Any scheduler works: <code className="bg-[#f5f7f9] px-1 rounded">node aic-usage-exporter.mjs</code> with the same two variables set.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-[14px] font-medium text-[#0e1b2c]" htmlFor={`key-${provider}`}>{label} admin key</label>
          <input
            id={`key-${provider}`}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`${KEY_HELP[provider].prefix}…`}
            className="w-full rounded-xl border border-[#dde2e8] bg-white px-3 h-11 text-[15px] text-[#0e1b2c] outline-none focus:border-[#a8772a]"
          />
          <p className="text-[13px] text-[#5e6b7b]">Create one in {KEY_HELP[provider].where}. A normal project key cannot read organisation usage.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={save}
          disabled={busy || (mode === 'api_key' && !key.trim())}
          className="h-11 sm:h-10 px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a] disabled:opacity-40"
        >
          {busy ? 'Saving…' : mode === 'api_key' ? 'Check key and connect' : live && i?.mode === 'exporter' ? 'Keep the exporter' : 'Use the exporter'}
        </button>
        {live && (
          <button onClick={disconnect} disabled={busy} className="h-11 sm:h-10 px-4 rounded-full text-[14px] font-medium text-[#b23a35] hover:bg-[#b23a35]/5 disabled:opacity-50">
            Disconnect
          </button>
        )}
      </div>
      {err && <p className="text-[13px] text-[#b23a35]">{err}</p>}
    </div>
  );
}
