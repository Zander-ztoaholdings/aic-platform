'use client';

import { X } from 'lucide-react';
import { Portal } from './Portal';

/**
 * A record opened over the page, in the middle of the screen, the way Notion
 * opens a page as a peek: the list stays visible but dimmed behind it, the
 * record gets a readable width, and Escape or a click outside closes it. On
 * a phone it takes the whole screen.
 *
 * Replaces the right-hand drawers, which squeezed long records into a narrow
 * column at the edge of a wide screen.
 */
export const PEEK_WIDTH = { md: 'sm:max-w-2xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-4xl' } as const;

export function PeekView({ title, subtitle, onClose, children, footer, size = 'lg', label }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof PEEK_WIDTH;
  /** Accessible name when the title is not plain text. */
  label?: string;
}) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex justify-center sm:items-start sm:px-6 sm:pt-[6vh] sm:pb-6" role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)}>
        <div data-peek-backdrop className="absolute inset-0 bg-[#0a1728]/40 backdrop-blur-[1px]" onClick={onClose} />
        <div className={`aic-peek relative flex h-full w-full ${PEEK_WIDTH[size]} flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[88vh] sm:rounded-2xl sm:border sm:border-[#dde2e8] sm:shadow-[0_30px_90px_-24px_rgba(10,23,40,0.5)]`}>
          <div className="flex items-start justify-between gap-4 border-b border-[#eef1f5] px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
              <h2 className="text-[20px] font-semibold leading-snug text-[#0e1b2c] break-words">{title}</h2>
              {subtitle && <div className="mt-0.5 text-[13px] text-[#5e6b7b]">{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef1f5] text-[#0e1b2c] hover:bg-[#dde2e8]" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">{children}</div>
          {footer && <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f5] px-5 py-4 sm:px-7">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
