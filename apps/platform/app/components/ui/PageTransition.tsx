'use client';

import { usePathname } from 'next/navigation';

/**
 * Re-keys the page on navigation so each new page settles in with the same
 * short rise-and-fade (see .page-enter in globals.css). The shell itself does
 * not move; only the content changes, the way a native app swaps a view.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
