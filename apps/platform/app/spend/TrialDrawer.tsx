'use client';

import { useState } from 'react';
import { Check, Copy, Download, X } from 'lucide-react';
import { Portal } from '@/app/components/ui/Portal';

/**
 * How to test a cheaper model on the client's own requests. Everything runs
 * on their machine with their provider key; only the counts come back to AIC.
 */
export function TrialDrawer({ from, to, judge, onClose }: { from: string; to: string; judge: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState('');
  const run = `node aic-model-trial.mjs --file samples.jsonl --from ${from} --to ${to}${judge ? ` --judge ${judge}` : ''} --limit 50`;
  const send = `AIC_API_KEY=aic_live_… ${run} --send`;
  const sample = `{"system": "You answer questions about home loans.", "prompt": "Can I pay my loan off early?"}\n{"prompt": "Summarise this complaint in one line: …", "reference": "Customer was charged twice for one payment."}`;
  const copy = (k: string, t: string) => { navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(''), 1500); }); };
  const Block = ({ k, text }: { k: string; text: string }) => (
    <div className="relative mt-2">
      <pre className="overflow-x-auto rounded-xl bg-[#0e1b2c] p-3.5 pr-12 text-[12.5px] leading-relaxed text-white"><code>{text}</code></pre>
      <button type="button" onClick={() => copy(k, text)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Copy">{copied === k ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
    </div>
  );

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex justify-center sm:items-start sm:px-6 sm:pt-[6vh] sm:pb-6" role="dialog" aria-modal="true" aria-label="Test it on your own requests">
        <div data-peek-backdrop className="absolute inset-0 bg-[#0a1728]/40 backdrop-blur-[1px]" onClick={onClose} />
        <div className="relative flex h-full w-full sm:max-w-3xl flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:border sm:border-[#dde2e8] sm:shadow-[0_30px_90px_-24px_rgba(10,23,40,0.5)] aic-peek">
          <div className="flex items-center justify-between border-b border-[#eef1f5] px-5 py-4">
            <div><h2 className="font-serif text-[20px] font-semibold text-[#0e1b2c]">Test it on your own requests</h2><p className="text-[12.5px] text-[#5e6b7b]">{from} against {to}</p></div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef1f5]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-[14px] leading-relaxed text-[#2b3a4d]">
            <p className="rounded-xl bg-[#2e7a57]/[0.07] px-3.5 py-2.5 text-[13.5px] text-[#1f5a40]">Your requests and the answers stay on your machine. AIC receives only the counts: how many answers were as good, how many worse, and the cost and speed of each model.</p>
            <section>
              <h3 className="font-semibold text-[#0e1b2c]">1. Save 20 to 100 typical requests</h3>
              <p className="mt-1 text-[13.5px] text-[#5e6b7b]">One per line in a file called samples.jsonl. Add a reference answer where you have a known good one; without it, the judge compares the cheaper model’s answer with today’s.</p>
              <Block k="sample" text={sample} />
            </section>
            <section>
              <h3 className="font-semibold text-[#0e1b2c]">2. Download the script</h3>
              <p className="mt-1 text-[13.5px] text-[#5e6b7b]">Node 18 or later, nothing to install. It calls the providers directly with your own key ({/^claude/i.test(from) || /^claude/i.test(to) ? 'ANTHROPIC_API_KEY' : ''}{(/^claude/i.test(from) || /^claude/i.test(to)) && (/^(gpt|o)/i.test(from) || /^(gpt|o)/i.test(to)) ? ' and ' : ''}{/^(gpt|o)/i.test(from) || /^(gpt|o)/i.test(to) ? 'OPENAI_API_KEY' : ''} in your environment).</p>
              <a href="/api/v1/model-trials/script" className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-full border border-[#dde2e8] px-4 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]"><Download className="h-4 w-4" />Download aic-model-trial.mjs</a>
            </section>
            <section>
              <h3 className="font-semibold text-[#0e1b2c]">3. Run it</h3>
              <p className="mt-1 text-[13.5px] text-[#5e6b7b]">It prints each verdict and the reason on your screen.{judge ? ` ${judge} judges the answers; it is not the model being tested.` : ''}</p>
              <Block k="run" text={run} />
            </section>
            <section>
              <h3 className="font-semibold text-[#0e1b2c]">4. Bring the score into AIC</h3>
              <p className="mt-1 text-[13.5px] text-[#5e6b7b]">Add --send with an AIC API key from Settings, API and access keys. The script shows exactly what it will send before it sends it, and the result appears next to this suggestion.</p>
              <Block k="send" text={send} />
            </section>
          </div>
        </div>
      </div>
    </Portal>
  );
}
