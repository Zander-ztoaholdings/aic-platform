'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children at the end of <body>. Dialogs need this: the
 * workspace shell animates its content with a transform, and a fixed element
 * inside a transformed parent is positioned against that parent rather than
 * the window, so a dialog would open part-way down the page.
 *
 * Everything rendered through a Portal is a modal view, so while one is open
 * the page behind it does not scroll, and Escape closes the topmost one by
 * clicking its backdrop (any element marked data-peek-backdrop).
 */
let open = 0;

export function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    open++;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const backdrops = document.querySelectorAll<HTMLElement>('[data-peek-backdrop]');
      const top = backdrops[backdrops.length - 1];
      if (top) { e.preventDefault(); top.click(); }
    };
    // Only the first open view listens, so one Escape closes one view.
    if (open === 1) window.addEventListener('keydown', esc);
    return () => {
      open--;
      window.removeEventListener('keydown', esc);
      if (open === 0) document.body.style.overflow = prev === 'hidden' ? '' : prev;
    };
  }, []);
  return ready ? createPortal(children, document.body) : null;
}
