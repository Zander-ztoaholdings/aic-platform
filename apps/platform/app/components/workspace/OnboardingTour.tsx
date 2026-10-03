'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

/**
 * The first-run tour of the client workspace.
 *
 * It points at the real interface rather than describing it: each step lights
 * up the actual control, and some steps wait for the person to use it (open a
 * menu) before moving on. It can be skipped at any point (Skip, or Esc), is
 * remembered per person in this browser, and can be restarted from the person
 * menu. Where a control is not on screen (a phone, where the menus collapse),
 * the step is shown as a centred card instead of pointing at nothing.
 */

type Step = {
  id: string;
  target?: string;               // data-tour value
  title: string;
  body: React.ReactNode;
  waitFor?: 'click';             // advance when the highlighted control is used
  hint?: string;
  adminOnly?: boolean;
};

export const TOUR_EVENT = 'aic:start-tour';
const KEY = (id: string) => `aic-tour-done:${id}`;

export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

export function OnboardingTour({ orgName }: { orgName: string | null }) {
  const { data } = useSession();
  const userId = data?.user?.id as string | undefined;
  const firstName = (data?.user?.name ?? '').split(' ')[0] || null;
  const isAdmin = data?.user?.role === 'ORG_ADMIN';
  const previewing = !!data?.user?.viewAs;

  const steps = useMemo<Step[]>(() => {
    const all: Step[] = [
      {
        id: 'welcome',
        title: firstName ? `Welcome to AIC, ${firstName}` : 'Welcome to AIC',
        body: (
          <>
            This is where {orgName ?? 'your organisation'} keeps its record of how it uses AI to make decisions about
            people, and who answers for each one. A quick look around takes about a minute.
          </>
        ),
      },
      {
        id: 'standing',
        target: 'standing',
        title: 'Your standing',
        body: 'The seal fills as you move through the seven stages towards certification. It only ever reflects your actual status, never an estimate.',
      },
      {
        id: 'overview',
        target: 'nav-overview',
        title: 'What you run',
        body: 'Your AI systems, the decisions they make, and who is accountable for each. Open this menu to see what is inside.',
        waitFor: 'click',
        hint: 'Click "AI Overview" to continue',
      },
      {
        id: 'compliance',
        target: 'nav-compliance',
        title: 'What the standard asks of you',
        body: 'Only the requirements that apply to your Division, the evidence against each, and anything an assessor has raised.',
      },
      {
        id: 'certification',
        target: 'nav-certification',
        title: 'Your badge and certificate',
        body: 'AIC Aware lives here: a free self-declaration with a badge anyone can verify. Certification follows when you are ready.',
        waitFor: 'click',
        hint: 'Click "AIC Certification" to continue',
      },
      {
        id: 'status',
        target: 'status',
        title: 'The figures that matter',
        body: 'Decisions recorded, how often a person overrode the AI, and open corrections. A dash means nothing has been recorded yet; nothing here is invented.',
      },
      {
        id: 'notifications',
        target: 'notifications',
        title: 'What needs you',
        body: 'Findings, requests from your assessor and deadlines arrive here.',
      },
      {
        id: 'account',
        target: 'account',
        title: 'Your account and team',
        body: 'Your profile, your organisation, inviting colleagues, and this tour again whenever you want it.',
      },
      {
        id: 'start',
        title: 'Three good first moves',
        body: null,
      },
    ];
    return all.filter((s) => !s.adminOnly || isAdmin);
  }, [firstName, orgName, isAdmin]);

  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = index === null ? null : steps[index];

  // First visit: start once the session is known. Never during a preview.
  useEffect(() => {
    if (!userId || previewing) return;
    let done = false;
    try { done = localStorage.getItem(KEY(userId)) === '1'; } catch { /* storage blocked: show it */ }
    if (!done) {
      const t = setTimeout(() => setIndex(0), 600);
      return () => clearTimeout(t);
    }
  }, [userId, previewing]);

  useEffect(() => {
    const on = () => setIndex(0);
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, []);

  const finish = useCallback(() => {
    setIndex(null);
    if (userId) { try { localStorage.setItem(KEY(userId), '1'); } catch { /* ignore */ } }
  }, [userId]);

  const next = useCallback(() => {
    setIndex((i) => (i === null ? null : i + 1 >= steps.length ? (finish(), null) : i + 1));
  }, [steps.length, finish]);
  const back = useCallback(() => setIndex((i) => (i && i > 0 ? i - 1 : i)), []);

  // Find and follow the highlighted control.
  useLayoutEffect(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    const visible = el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    if (!visible) { setRect(null); return; }
    el!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const update = () => setRect(el!.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    let onClick: (() => void) | null = null;
    if (step.waitFor === 'click') {
      onClick = () => setTimeout(next, 450);
      el!.addEventListener('click', onClick, { once: true });
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      if (onClick) el!.removeEventListener('click', onClick);
    };
  }, [step, next]);

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    cardRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [index, finish, next, back]);

  if (!step || index === null) return null;

  const pad = 8;
  const pointing = !!rect;
  const cardW = 340;
  let cardStyle: React.CSSProperties = {};
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.bottom + 16 + 220 < vh;
    cardStyle = {
      position: 'fixed',
      width: cardW,
      left: Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16),
      top: below ? rect.bottom + pad + 12 : undefined,
      bottom: below ? undefined : vh - rect.top + pad + 12,
    };
  }

  const last = index === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" aria-live="polite">
      {/* Dimmed page with a window cut around the control in focus. The page
          stays clickable, so steps that ask you to use a control work. */}
      {pointing ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-[#d9a53a] transition-all duration-300 motion-reduce:transition-none"
          style={{
            left: rect!.left - pad, top: rect!.top - pad, width: rect!.width + pad * 2, height: rect!.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(14,27,44,0.55)',
          }}
        />
      ) : (
        <div className="pointer-events-auto fixed inset-0 bg-[#0e1b2c]/55" />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-label={step.title}
        className={`pointer-events-auto outline-none rounded-2xl bg-white p-6 text-[#0e1b2c] shadow-[0_24px_60px_-20px_rgba(14,27,44,0.45)] ${pointing ? '' : 'fixed left-1/2 top-1/2 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2'}`}
        style={pointing ? cardStyle : undefined}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s.id} className={`h-1 rounded-full transition-all ${i === index ? 'w-5 bg-[#a8772a]' : i < index ? 'w-1.5 bg-[#a8772a]/50' : 'w-1.5 bg-[#dde2e8]'}`} />
            ))}
          </div>
          <button onClick={finish} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Skip tour</button>
        </div>

        <h2 className="mt-4 font-serif text-[22px] font-semibold leading-tight">{step.title}</h2>

        {step.id === 'start' ? (
          <div className="mt-3 space-y-2">
            <p className="text-[14px] leading-relaxed text-[#5e6b7b]">Most organisations start here. Each takes a few minutes.</p>
            {[
              { href: '/aware', t: 'Name your accountable person and take AIC Aware', d: 'Ends with a free badge you can put on your website.' },
              { href: '/overview', t: 'Declare your first AI system', d: 'What it decides, about whom, and who answers for it.' },
              ...(isAdmin ? [{ href: '/settings', t: 'Invite a colleague', d: 'Share the work with whoever holds the evidence.' }] : []),
            ].map((m) => (
              <Link key={m.href} href={m.href} onClick={finish} className="block rounded-xl border border-[#dde2e8] px-4 py-3 hover:border-[#a8772a] hover:bg-[#a8772a]/[0.04]">
                <span className="block text-[14px] font-semibold">{m.t}</span>
                <span className="block text-[13px] text-[#5e6b7b]">{m.d}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-[#5e6b7b]">{step.body}</p>
        )}

        {step.waitFor && pointing && step.hint && (
          <p className="mt-3 text-[13px] font-medium text-[#8a6a1f]">{step.hint}</p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={back} disabled={index === 0} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c] disabled:invisible">Back</button>
          <button onClick={last ? finish : next} className="rounded-full bg-[#0e1b2c] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#1b2c44]">
            {index === 0 ? 'Show me around' : last ? 'Done' : step.waitFor && pointing ? 'Skip this step' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
