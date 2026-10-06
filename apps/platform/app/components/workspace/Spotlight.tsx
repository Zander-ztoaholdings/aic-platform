'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Lights up one control on the page and dims the rest.
 *
 * - Waits for the control to appear (pages load their data after they
 *   render), for up to five seconds.
 * - Scrolls it to the middle of the screen, clear of the sticky top bar,
 *   wherever the person had scrolled to, and keeps the light on it while the
 *   page scrolls, resizes or the control changes size.
 * - Only the lit control can be used. The dimmed page around it is inert, so
 *   a stray click cannot wander off mid-step; clicking it closes the light
 *   when `onDismiss` is given.
 */

export type SpotRect = { left: number; top: number; width: number; height: number };

const PAD = 8;

function stickyOffset(): number {
  // The workspace top bar (and status strip, when it is sticky) sit over the page.
  let h = 0;
  document.querySelectorAll<HTMLElement>('header.sticky, [data-sticky-chrome]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top <= 0 + 1 && r.bottom > h) h = r.bottom;
  });
  return h;
}

function inFixedLayer(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
    const p = getComputedStyle(n).position;
    if (p === 'fixed' || p === 'sticky') return true;
  }
  return false;
}

/** Finds the first visible element for any of the data-tour names, waiting for it to render. */
export function useTourTarget(names: string[] | null, timeoutMs = 5000): { el: HTMLElement | null; searching: boolean } {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [searching, setSearching] = useState(false);
  const key = names?.join('|') ?? '';
  useEffect(() => {
    if (!key) { setEl(null); setSearching(false); return; }
    const list = key.split('|');
    const find = () => {
      for (const n of list) {
        const all = document.querySelectorAll<HTMLElement>(`[data-tour="${n}"]`);
        for (const c of all) { const r = c.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return c; }
      }
      return null;
    };
    const now = find();
    if (now) { setEl(now); setSearching(false); return; }
    setEl(null); setSearching(true);
    const mo = new MutationObserver(() => { const f = find(); if (f) { setEl(f); setSearching(false); mo.disconnect(); } });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tour', 'class', 'style'] });
    const t = setTimeout(() => { mo.disconnect(); setSearching(false); }, timeoutMs);
    return () => { mo.disconnect(); clearTimeout(t); };
  }, [key, timeoutMs]);
  return { el, searching };
}

/** Keeps a live rectangle for the element, after bringing it into view. */
export function useSpotRect(el: HTMLElement | null): SpotRect | null {
  const [rect, setRect] = useState<SpotRect | null>(null);
  useLayoutEffect(() => {
    if (!el) { setRect(null); return; }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect((prev) => (prev && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
        ? prev : { left: r.left, top: r.top, width: r.width, height: r.height }));
    };
    if (!inFixedLayer(el)) {
      const r = el.getBoundingClientRect();
      const top = stickyOffset();
      const room = window.innerHeight - top;
      // Tall sections are brought to just under the top bar; short ones to the middle of what is left.
      const want = r.height + PAD * 2 > room * 0.6 ? top + 16 : top + (room - r.height) / 2;
      const by = r.top - want;
      if (Math.abs(by) > 4) window.scrollTo({ top: window.scrollY + by, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    measure();
    // Follow the smooth scroll and any layout shift for a moment, then on events.
    let raf = 0; const until = performance.now() + 900;
    const loop = () => { measure(); if (performance.now() < until) raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(measure); ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [el]);
  return rect;
}

/** Where to put a card of this size next to the rectangle, inside the screen. */
export function placeCard(rect: SpotRect | null, w: number, h: number): React.CSSProperties | null {
  if (!rect || typeof window === 'undefined') return null;
  const vw = window.innerWidth; const vh = window.innerHeight; const m = 16;
  if (vw < 640) return null; // phones: the card docks to the bottom instead
  const width = Math.min(w, vw - m * 2);
  const left = Math.min(Math.max(m, rect.left + rect.width / 2 - width / 2), vw - width - m);
  const below = rect.top + rect.height + PAD + 12;
  const above = rect.top - PAD - 12 - h;
  if (below + h < vh - m) return { position: 'fixed', width, left, top: below };
  if (above > m) return { position: 'fixed', width, left, top: above };
  // Neither fits: beside it, or pinned to the bottom of the screen.
  const right = rect.left + rect.width + PAD + 12;
  if (right + width < vw - m) return { position: 'fixed', width, left: right, top: Math.min(Math.max(m, rect.top), vh - h - m) };
  if (rect.left - PAD - 12 - width > m) return { position: 'fixed', width, left: rect.left - PAD - 12 - width, top: Math.min(Math.max(m, rect.top), vh - h - m) };
  return { position: 'fixed', width, left, bottom: m };
}

/** The dimmed page with a lit window. Only the window takes clicks. */
export function SpotlightLayer({ rect, onDismiss, pulse = true }: { rect: SpotRect | null; onDismiss?: () => void; pulse?: boolean }) {
  const dim = 'pointer-events-auto fixed bg-[#0e1b2c]/55 transition-[top,left,width,height] duration-200 motion-reduce:transition-none';
  if (!rect) return <div className="pointer-events-auto fixed inset-0 bg-[#0e1b2c]/55" onClick={onDismiss} />;
  const l = Math.max(0, rect.left - PAD); const t = Math.max(0, rect.top - PAD);
  const r = rect.left + rect.width + PAD; const b = rect.top + rect.height + PAD;
  return (
    <>
      <div className={dim} style={{ left: 0, top: 0, right: 0, height: t }} onClick={onDismiss} />
      <div className={dim} style={{ left: 0, top: b, right: 0, bottom: 0 }} onClick={onDismiss} />
      <div className={dim} style={{ left: 0, top: t, width: l, height: b - t }} onClick={onDismiss} />
      <div className={dim} style={{ left: r, top: t, right: 0, height: b - t }} onClick={onDismiss} />
      <div
        aria-hidden
        className={`pointer-events-none fixed rounded-xl ring-2 ring-[#d9a53a] transition-[top,left,width,height] duration-200 motion-reduce:transition-none ${pulse ? 'tour-pulse' : ''}`}
        style={{ left: l, top: t, width: r - l, height: b - t }}
      />
    </>
  );
}

/** Measures a card so it can be placed; re-renders once its height is known. */
export function useCardHeight(dep: unknown): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(220);
  useLayoutEffect(() => { if (ref.current) setH(ref.current.offsetHeight); }, [dep]);
  return [ref, h];
}
