'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CLIENT_NAV } from './nav';
import { SpotlightLayer, placeCard, useCardHeight, useSpotRect, useTourTarget } from './Spotlight';
import { startSetupGuide } from './SetupGuide';

/**
 * The first-run look around the client workspace.
 *
 * It points at the real interface: each step lights up the actual control
 * and dims the rest, and the dimmed page cannot be clicked while a step is
 * open. It always starts from the dashboard, wherever it was started from,
 * and brings each control into view however far down the page you were.
 * Where a control is not on screen (a phone, where the menus collapse) the
 * step is a card at the bottom of the screen instead.
 *
 * It ends by offering the set-up guide (SetupGuide), which walks through
 * the actual set-up page by page. Skip or Esc at any point; it is
 * remembered per person in this browser and can be restarted from the
 * person menu.
 */

type Step = { id: string; target?: string; title: string; body: React.ReactNode };

export const TOUR_EVENT = 'aic:start-tour';
const DONE_KEY = (id: string) => `aic-tour-done:${id}`;
const RESUME_KEY = 'aic-tour-resume';

export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* blocked */ } },
  sget: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  sset: (k: string, v: string | null) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* blocked */ } },
};

const inside = (key: string) => CLIENT_NAV.find((g) => g.key === key)?.items.map((i) => i.label).join(', ');

export function OnboardingTour({ orgName }: { orgName: string | null }) {
  const { data } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = data?.user?.id as string | undefined;
  const firstName = (data?.user?.name ?? '').split(' ')[0] || null;
  const previewing = !!data?.user?.viewAs;

  const steps = useMemo<Step[]>(() => [
    {
      id: 'welcome',
      title: firstName ? `Welcome to AIC, ${firstName}` : 'Welcome to AIC',
      body: <>This is where {orgName ?? 'your organisation'} keeps its record of how it uses AI to make decisions about people, and who answers for each one. A quick look around takes about a minute; then a guide walks you through setting up, one page at a time.</>,
    },
    { id: 'standing', target: 'standing', title: 'Your standing', body: 'The seal fills as you move through the seven stages towards certification. It only ever reflects your actual status, never an estimate.' },
    { id: 'shortcuts', target: 'dash-shortcuts', title: 'The things you do most', body: 'Onboard a new person, declare a new AI system, or deploy an agent, in one click from here.' },
    { id: 'tiles', target: 'dash-tiles', title: 'Your AI exposure at a glance', body: 'How many AI systems you run, the decisions they made this month and how often a person overrode them, what you spend on AI, and anything open. Each tile opens the page behind it.' },
    { id: 'needs', target: 'dash-needs', title: 'What needs you', body: 'Gaps AIC can see in your record, most urgent first. Each one links to where you fix it.' },
    { id: 'overview', target: 'nav-overview', title: 'What you run', body: `Your AI systems, the decisions they make, what you spend, and who is accountable for each. Inside: ${inside('overview')}. Agents is an optional tool for running your own agents from AIC; using it does not raise or lower your chance of certification.` },
    { id: 'compliance', target: 'nav-compliance', title: 'What the standard asks of you', body: `The requirements that apply to you, and the evidence against each. Inside: ${inside('compliance')}.` },
    { id: 'people', target: 'nav-people', title: 'Risk and people', body: `The registers every assessor asks for. Inside: ${inside('people')}.` },
    { id: 'certification', target: 'nav-certification', title: 'Your badge and certificate', body: `AIC Aware, a free self-declaration with a badge anyone can verify, and certification when you are ready. Inside: ${inside('certification')}.` },
    { id: 'status', target: 'status', title: 'The figures that matter', body: 'Decisions recorded, how often a person overrode the AI, failing checks and open corrections, on every page. A dash means nothing has been recorded yet.' },
    { id: 'notifications', target: 'notifications', title: 'Messages for you', body: 'Findings, requests from your assessor and deadlines arrive here.' },
    { id: 'account', target: 'account', title: 'Your account and team', body: 'Your profile, your organisation, inviting colleagues, and this tour and the set-up guide again whenever you want them.' },
    { id: 'setup', title: 'Now, set up your workspace', body: 'The set-up guide takes you to each page in turn, lights up the one thing to do there, and ticks it off when your record shows it is done. Leave it whenever you like and pick it up from the dashboard.' },
  ], [firstName, orgName]);

  const [index, setIndex] = useState<number | null>(null);
  const step = index === null ? null : steps[index];

  const begin = useCallback((at = 0) => {
    // The tour belongs to the dashboard; go there first and carry on after the page changes.
    if (pathname !== '/dashboard') { store.sset(RESUME_KEY, String(at)); router.push('/dashboard'); return; }
    setIndex(at);
  }, [pathname, router]);

  // First visit, or resuming after the move to the dashboard. Never during a preview.
  useEffect(() => {
    if (!userId || previewing) return;
    const resume = store.sget(RESUME_KEY);
    if (resume !== null && pathname === '/dashboard') { store.sset(RESUME_KEY, null); const t = setTimeout(() => setIndex(Number(resume) || 0), 300); return () => clearTimeout(t); }
    if (store.get(DONE_KEY(userId)) !== '1' && pathname === '/dashboard') {
      const t = setTimeout(() => setIndex(0), 700);
      return () => clearTimeout(t);
    }
  }, [userId, previewing, pathname]);

  useEffect(() => {
    const on = () => begin(0);
    window.addEventListener(TOUR_EVENT, on);
    return () => window.removeEventListener(TOUR_EVENT, on);
  }, [begin]);

  const finish = useCallback(() => {
    setIndex(null);
    if (userId) store.set(DONE_KEY(userId), '1');
  }, [userId]);
  const next = useCallback(() => setIndex((i) => (i === null ? null : i + 1 >= steps.length ? null : i + 1)), [steps.length]);
  const back = useCallback(() => setIndex((i) => (i && i > 0 ? i - 1 : i)), []);

  const { el, searching } = useTourTarget(step?.target ? [step.target] : null, 900);
  const rect = useSpotRect(el);
  const [cardRef, cardH] = useCardHeight(`${index}-${!!rect}`);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    cardRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [index, finish, next, back, cardRef]);

  if (!step || index === null) return null;
  if (step.target && searching) return <div className="pointer-events-auto fixed inset-0 z-[70] bg-[#0e1b2c]/55" />;

  const placed = placeCard(rect, 360, cardH);
  const last = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[70]" aria-live="polite">
      <SpotlightLayer rect={rect} />
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-label={step.title}
        className={`pointer-events-auto outline-none rounded-2xl bg-white p-5 sm:p-6 text-[#0e1b2c] shadow-[0_24px_60px_-20px_rgba(14,27,44,0.45)] ${
          placed ? '' : rect ? 'fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2' : 'fixed left-1/2 top-1/2 w-[min(460px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2'
        }`}
        style={placed ?? undefined}
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
        <p className="mt-2 text-[14px] leading-relaxed text-[#5e6b7b]">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={back} disabled={index === 0} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c] disabled:invisible">Back</button>
          {last ? (
            <div className="flex items-center gap-3">
              <button onClick={finish} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Later</button>
              <button onClick={() => { finish(); startSetupGuide(); }} className="rounded-full bg-[#0e1b2c] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#1b2c44]">Start the set-up guide</button>
            </div>
          ) : (
            <button onClick={next} className="rounded-full bg-[#0e1b2c] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#1b2c44]">{index === 0 ? 'Show me around' : 'Next'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
