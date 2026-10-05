'use client';

import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

const recordSnippet = (BASE: string) => `curl -X POST ${BASE}/api/decisions \\
  -H "Authorization: Bearer aic_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "system_name": "Claims triage",
    "input_params": { "claim_ref": "anonymised-ref", "amount": 18500 },
    "outcome": { "decision": "refer", "score": 0.71 },
    "explanation": "Amount above auto-approve limit"
  }'`;

const holdSnippet = (BASE: string) => `curl -X POST ${BASE}/api/decisions \\
  -H "Authorization: Bearer aic_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "system_name": "Loan pre-screening",
    "input_params": { "application": "anonymised-ref" },
    "outcome": { "decision": "decline" },
    "require_review": true,
    "review_within_hours": 24,
    "external_ref": "APP-10293",
    "callback_url": "https://your-system.example.com/aic/review"
  }'

# 202 Accepted: { "id": "…", "review_status": "pending", "poll_url": "/api/decisions/…" }
# Do not act until review_status is "approved" or "overridden".
# Then use final_outcome. Poll GET /api/decisions/<id>, or wait for the callback:
#   POST callback_url  { id, external_ref, review_status, final_outcome, reviewed_at, reviewer, note }
#   X-AIC-Timestamp: <unix seconds>
#   X-AIC-Signature: sha256=HMAC_SHA256(secret, "<timestamp>.<raw body>")`;

function Code({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-[#0e1b2c] p-4 text-[12px] leading-relaxed text-white/85">{text}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        className="absolute right-2 top-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[12px] text-white hover:bg-white/20"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** How a system records decisions, and how it asks a person to approve one first. */
export function DeveloperGuide({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<'record' | 'hold'>('record');
  // The page's own origin, read after hydration so server and client render the same text first.
  const [base, setBase] = useState('https://app.aiccertified.cloud');
  useEffect(() => { setBase(window.location.origin); }, []);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState('');
  async function reveal() {
    const r = await fetch('/api/keys/callback-secret');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? 'Could not load it.'); return; }
    setSecret(j.secret);
  }
  return (
    <div className="rounded-xl border border-[#dde2e8] bg-white p-5">
      <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Connect a system</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">Send personal details anonymised: AIC needs the decision and enough context to review it, not the person&apos;s identity.</p>
      <div className="mt-3 inline-flex rounded-full border border-[#dde2e8] bg-white p-1">
        <button onClick={() => setTab('record')} className={`h-9 rounded-full px-4 text-sm font-medium ${tab === 'record' ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b]'}`}>Record a decision</button>
        <button onClick={() => setTab('hold')} className={`h-9 rounded-full px-4 text-sm font-medium ${tab === 'hold' ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b]'}`}>Hold for a person</button>
      </div>
      <div className="mt-3">
        {tab === 'record' ? <Code text={recordSnippet(base)} /> : (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-[#5e6b7b]">For decisions with legal or similarly significant effect on a person (POPIA section 71): AIC holds the decision on your Decision log until a named person in your organisation approves or overrides it, records who and why, and tells your system.</p>
            <Code text={holdSnippet(base)} />
            {canManage && (
              <div className="mt-3 rounded-xl bg-[#f5f7f9] p-3 text-[13px]">
                <div className="font-medium text-[#0e1b2c]">Callback signing secret</div>
                {secret ? <code className="mt-1 block break-all text-[12px] text-[#0e1b2c]">{secret}</code> : (
                  <button onClick={reveal} className="mt-1 font-medium text-[#8a6a1f] hover:underline underline-offset-2">Show the secret</button>
                )}
                {err && <p className="mt-1 text-[#b42318]">{err}</p>}
                <p className="mt-1 text-[12px] text-[#5e6b7b]">Check every callback&apos;s signature with it, and reject callbacks more than five minutes old.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
