'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow, SectionCard, CopperTag } from '../components/ui/Eyebrow';

/**
 * Register Drafter — explainer / "coming soon" view only.
 *
 * Zander (2026-09): "we can make a view for the register drafter llm
 * provider page with an expander to what it does but we don't build it
 * ... coming soon." This page describes the feature and lets a client
 * understand what's coming; it does not call an LLM or write anything.
 * Declaring a system today still goes through the real, working form on
 * /overview (AddSystemForm -> POST /api/ai-systems).
 *
 * Why this isn't built yet: it needs a provider decision first — which
 * model, where the data-residency boundary sits for a South African
 * client's system description, and how a drafted declaration gets
 * reviewed for accuracy before anything is saved. That decision is
 * Zander's to make, not something to default silently the way
 * READ_ONLY_MECHANISM's fallback was.
 */

const STEPS: { title: string; body: string }[] = [
  {
    title: '1. Describe it in your own words',
    body: "No taxonomy required upfront. You'd write a plain-language description of the system — what it does, who it affects, how it makes or supports a decision — the same way you'd explain it to a colleague, not the way AIC's forms currently ask for it.",
  },
  {
    title: '2. Register Drafter proposes a declaration',
    body: 'From that description, it would draft the structured fields the AI Estate actually needs: a suggested risk tier, which of the five Rights the system touches (Human Agency, Explainability, Empathy, Correction, Disclosure), a lifecycle stage, and a starting list of the evidence that Right will ask for.',
  },
  {
    title: '3. A human reviews every field before anything is saved',
    body: "Nothing gets written to the AI Estate until someone at your organisation confirms it. Every field the draft proposes is editable — this is a starting point for a person to correct, not an autonomous declaration. That's the same human-in-the-loop principle AIC audits everyone else against.",
  },
  {
    title: '4. Once approved, it is a normal AI Estate entry',
    body: 'No separate record type, no separate audit trail. It becomes exactly the same kind of declared system you get today from the manual form — this only changes how the first draft gets written, not what happens after.',
  },
];

export default function RegisterDrafterPage() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto pb-24 pt-8 px-4">
        <Eyebrow>AI Overview · AI Estate</Eyebrow>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="font-serif text-2xl font-bold text-[#0f1f3d]">Register Drafter</h1>
          <CopperTag>Coming Soon</CopperTag>
        </div>

        <p className="text-sm text-[#4b5563] leading-relaxed mb-8 max-w-xl">
          Declaring an AI system today means knowing AIC&apos;s taxonomy before you start — risk
          tier, lifecycle stage, which Right applies. Register Drafter is a planned assistant that
          would take a plain-language description of a system and turn it into a draft declaration
          for a person at your organisation to review and correct, instead of asking you to fill in
          AIC&apos;s categories from a blank form.
        </p>

        <SectionCard className="mb-8 flex items-start gap-3.5">
          <Sparkles className="w-4 h-4 text-[#c9920a] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-[#0f1f3d] mb-1">Not built yet — and won&apos;t default silently</p>
            <p className="text-xs text-[#6b7280] leading-relaxed">
              This needs a provider decision before it can be built: which model, where the data
              residency boundary sits for a client&apos;s own system description, and how a drafted
              declaration gets checked for accuracy. That&apos;s Zander&apos;s call to make, so this stays
              an explainer until it&apos;s made.
            </p>
          </div>
        </SectionCard>

        <div className="mb-3">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">
            How this will work
          </span>
        </div>

        <div className="space-y-2 mb-8">
          {STEPS.map((step, i) => {
            const isOpen = !!open[i];
            return (
              <div
                key={step.title}
                className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(10,22,40,0.05)]"
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f9fafb] transition-colors"
                >
                  <span className="font-serif text-sm font-bold text-[#0f1f3d]">{step.title}</span>
                  <ChevronDown
                    className="w-4 h-4 text-[#9ca3af] transition-transform ml-auto flex-shrink-0"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-[#e5e7eb] px-4 pb-4 pt-3">
                    <p className="text-xs text-[#4b5563] leading-relaxed">{step.body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[#e5e7eb]">
          <ShieldCheck className="w-4 h-4 text-[#3f8f83] flex-shrink-0" />
          <p className="text-xs text-[#6b7280] flex-1 min-w-[200px]">
            You can declare a system today — the manual form on AI Estate is live now.
          </p>
          <Link
            href="/overview"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] bg-[#0f1f3d] text-white rounded-full px-4 py-2 hover:bg-[#0A1728] transition-colors"
          >
            Declare a System <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
