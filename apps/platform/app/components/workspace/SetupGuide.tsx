'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { SetupProgress, SetupStepId } from '@/lib/onboarding';
import { SpotlightLayer, placeCard, useCardHeight, useSpotRect, useTourTarget } from './Spotlight';

/**
 * The set-up guide: a small panel that stays with the person from page to
 * page until the workspace is set up.
 *
 * It shows one step at a time. "Show me" goes to the page and lights up the
 * one thing to do there; the rest of the page is dimmed and inert until they
 * close the light. Steps tick themselves off when the record shows them done
 * (lib/onboarding.ts), checked when a page opens, when the window regains
 * focus, and every few seconds while they are on the step's page. A step can
 * be skipped and come back later. The panel can be folded down or closed and
 * reopened from the dashboard or the person menu.
 */

export const SETUP_EVENT = 'aic:start-setup';
export function startSetupGuide() { window.dispatchEvent(new Event(SETUP_EVENT)); }

type Saved = { active: boolean; folded: boolean; skipped: SetupStepId[] };
const KEY = (u: string) => `aic-setup-guide:${u}`;
const SPOT_KEY = 'aic-setup-spot';
const load = (u: string): Saved => { try { return { active: false, folded: false, skipped: [], ...JSON.parse(localStorage.getItem(KEY(u)) ?? '{}') }; } catch { return { active: false, folded: false, skipped: [] }; } };
const save = (u: string, s: Saved) => { try { localStorage.setItem(KEY(u), JSON.stringify(s)); } catch { /* blocked */ } };
const spot = { get: () => { try { return sessionStorage.getItem(SPOT_KEY); } catch { return null; } }, set: (v: string | null) => { try { if (v) sessionStorage.setItem(SPOT_KEY, v); else sessionStorage.removeItem(SPOT_KEY); } catch { /* blocked */ } } };

export function SetupGuide() {
  const { data } = useSession();
  const userId = data?.user?.id as string | undefined;
  const previewing = !!data?.user?.viewAs;
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState<Saved>({ active: false, folded: false, skipped: [] });
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [lit, setLit] = useState<SetupStepId | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [list, setList] = useState(false);
  const prevDone = useRef<Set<string>>(new Set());

  useEffect(() => { if (userId) setSaved(load(userId)); }, [userId]);
  const update = useCallback((patch: Partial<Saved>) => {
    setSaved((s) => { const n = { ...s, ...patch }; if (userId) save(userId, n); return n; });
  }, [userId]);

  const refresh = useCallback(async () => {
    const r = await fetch('/api/onboarding/progress', { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return;
    const p = (await r.json()) as SetupProgress;
    const nowDone = new Set(p.steps.filter((s) => s.done).map((s) => s.id));
    const fresh = p.steps.find((s) => s.done && prevDone.current.size > 0 && !prevDone.current.has(s.id));
    if (fresh) { setJustDone(fresh.title); setLit(null); setTimeout(() => setJustDone(null), 4000); }
    prevDone.current = nowDone;
    setProgress(p);
  }, []);

  // Start from anywhere: the tour's last step, the dashboard panel, the person menu.
  useEffect(() => {
    const on = () => { update({ active: true, folded: false }); void refresh(); };
    window.addEventListener(SETUP_EVENT, on);
    return () => window.removeEventListener(SETUP_EVENT, on);
  }, [update, refresh]);

  const active = saved.active && !previewing;
  useEffect(() => { if (active) void refresh(); }, [active, pathname, refresh]);
  useEffect(() => {
    if (!active) return;
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 8000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(t); };
  }, [active, refresh]);

  const current = useMemo(() => {
    if (!progress) return null;
    return progress.steps.find((s) => !s.done && !saved.skipped.includes(s.id)) ?? progress.steps.find((s) => !s.done) ?? null;
  }, [progress, saved.skipped]);

  // After "Show me" moved to another page, light the step up once it has loaded.
  useEffect(() => {
    const want = spot.get() as SetupStepId | null;
    const s = want ? progress?.steps.find((x) => x.id === want) : null;
    if (s && pathname === s.href) { spot.set(null); setLit(s.id); }
  }, [pathname, progress]);

  const litStep = progress?.steps.find((s) => s.id === lit) ?? null;
  const onItsPage = !!litStep && pathname === litStep.href;
  const { el, searching } = useTourTarget(onItsPage ? litStep!.targets : null, 5000);
  const rect = useSpotRect(el);
  const [cardRef, cardH] = useCardHeight(`${lit}-${!!rect}`);

  useEffect(() => {
    if (!lit) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLit(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lit]);

  if (!active || !progress) return null;

  const showMe = (id: SetupStepId) => {
    const s = progress.steps.find((x) => x.id === id);
    if (!s) return;
    update({ folded: false });
    if (pathname === s.href) setLit(id);
    else { spot.set(id); router.push(s.href); }
  };
  const skip = (id: SetupStepId) => { setLit(null); update({ skipped: [...saved.skipped.filter((x) => x !== id), id] }); };
  const close = () => { setLit(null); update({ active: false }); };
  const allDone = progress.done === progress.total;
  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <>
      {litStep && onItsPage && (
        <div className="fixed inset-0 z-[65]" aria-live="polite">
          {searching ? <div className="pointer-events-auto fixed inset-0 bg-[#0e1b2c]/40" /> : <SpotlightLayer rect={rect} onDismiss={() => setLit(null)} />}
          {!searching && (
            <div
              ref={cardRef}
              role="dialog"
              aria-label={litStep.title}
              className={`pointer-events-auto rounded-2xl bg-white p-5 text-[#0e1b2c] shadow-[0_24px_60px_-20px_rgba(14,27,44,0.45)] ${placeCard(rect, 360, cardH) ? '' : 'fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] sm:inset-x-auto sm:left-1/2 sm:w-[420px] sm:-translate-x-1/2'}`}
              style={placeCard(rect, 360, cardH) ?? undefined}
            >
              <p className="text-[12.5px] text-[#8a6a1f]">Set-up, step {progress.steps.findIndex((s) => s.id === litStep.id) + 1} of {progress.total}</p>
              <h2 className="mt-1 font-serif text-[20px] font-semibold leading-tight">{litStep.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[#2b3a4d]">{litStep.how}</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <button onClick={() => skip(litStep.id)} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Skip for now</button>
                <button onClick={() => setLit(null)} className="rounded-full bg-[#0e1b2c] px-5 py-2 text-[13px] font-medium text-white hover:bg-[#1b2c44]">I’ll do it</button>
              </div>
            </div>
          )}
        </div>
      )}

      <aside
        aria-label="Set-up guide"
        className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
      >
        {saved.folded ? (
          <button onClick={() => update({ folded: false })} className="ml-auto flex h-11 items-center gap-2.5 rounded-full bg-[#0e1b2c] pl-4 pr-3 text-[13.5px] font-medium text-white shadow-[0_12px_30px_-12px_rgba(14,27,44,0.6)]">
            <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/20"><span className="absolute inset-y-0 left-0 rounded-full bg-[#d9a53a]" style={{ width: `${pct}%` }} /></span>
            Set-up {progress.done} of {progress.total}
            <ChevronUp className="h-4 w-4" />
          </button>
        ) : (
          <div className="rounded-2xl border border-[#dde2e8] bg-white text-[#0e1b2c] shadow-[0_20px_50px_-20px_rgba(14,27,44,0.45)]">
            <div className="flex items-center gap-3 border-b border-[#eef1f5] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold">Set up your workspace</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f5]"><span className="absolute inset-y-0 left-0 rounded-full bg-[#2e7a57] transition-all" style={{ width: `${pct}%` }} /></span>
                  <span className="text-[12px] text-[#5e6b7b]">{progress.done} of {progress.total}</span>
                </div>
              </div>
              <button onClick={() => update({ folded: true })} className="flex h-8 w-8 items-center justify-center rounded-full text-[#5e6b7b] hover:bg-[#f5f7f9]" aria-label="Fold the guide"><ChevronDown className="h-4 w-4" /></button>
              <button onClick={close} className="flex h-8 w-8 items-center justify-center rounded-full text-[#5e6b7b] hover:bg-[#f5f7f9]" aria-label="Close the guide"><X className="h-4 w-4" /></button>
            </div>

            <div className="px-4 py-3.5">
              {justDone && <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#2e7a57]"><Check className="h-4 w-4" />Done: {justDone}</p>}
              {allDone ? (
                <>
                  <p className="text-[14px] font-semibold">Your workspace is set up</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">From here the dashboard shows what needs you. When you are ready, apply for certification from My Certificate.</p>
                  <button onClick={close} className="mt-3 rounded-full bg-[#0e1b2c] px-4 py-2 text-[13px] font-medium text-white">Close the guide</button>
                </>
              ) : current && (
                <>
                  <p className="text-[12px] text-[#8a95a3]">Next, about {current.minutes} {current.minutes === 1 ? 'minute' : 'minutes'}</p>
                  <p className="mt-0.5 text-[15px] font-semibold leading-snug">{current.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">{current.why}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button onClick={() => showMe(current.id)} className="rounded-full bg-[#0e1b2c] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#1b2c44]">{pathname === current.href ? 'Show me where' : 'Take me there'}</button>
                    <button onClick={() => skip(current.id)} className="text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">Skip for now</button>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[#eef1f5]">
              <button onClick={() => setList(!list)} className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] text-[#5e6b7b] hover:text-[#0e1b2c]">
                All steps {list ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {list && (
                <ol className="max-h-[38vh] overflow-y-auto px-2 pb-2">
                  {progress.steps.map((s, i) => (
                    <li key={s.id}>
                      <button onClick={() => !s.done && showMe(s.id)} disabled={s.done} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] ${s.done ? 'text-[#8a95a3]' : 'text-[#0e1b2c] hover:bg-[#f5f7f9]'} ${current?.id === s.id ? 'bg-[#a8772a]/[0.07]' : ''}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${s.done ? 'bg-[#2e7a57] text-white' : 'border border-[#c9ced6] text-[#5e6b7b]'}`}>{s.done ? <Check className="h-3 w-3" /> : i + 1}</span>
                        <span className={s.done ? 'line-through decoration-[#c9ced6]' : ''}>{s.title}</span>
                        {saved.skipped.includes(s.id) && !s.done && <span className="ml-auto text-[11.5px] text-[#8a95a3]">skipped</span>}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
