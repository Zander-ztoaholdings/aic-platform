'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders its children at the end of <body>. Drawers and dialogs need this:
 * the workspace shell animates its content with a transform, and a fixed
 * element inside a transformed parent is positioned against that parent
 * rather than the window, so a drawer would open part-way down the page.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}
