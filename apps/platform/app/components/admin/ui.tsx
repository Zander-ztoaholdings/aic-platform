'use client';

/**
 * Small, shared pieces for the staff admin screens. Quiet on purpose: the
 * information is the design here, not the chrome.
 */

export const field =
  'w-full rounded-lg border border-[#dde2e8] bg-white px-3 py-2 text-sm text-[#0e1b2c] placeholder:text-[#8a95a3] outline-none focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/20';

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gold'; children: React.ReactNode }) {
  const t = {
    neutral: 'bg-[#f5f7f9] text-[#5e6b7b]',
    good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-red-50 text-red-700',
    gold: 'bg-[#d9a53a]/15 text-[#8a6a1f]',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Button({ variant = 'default', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  const v = {
    default: 'border border-[#dde2e8] bg-[#f5f7f9] text-[#0e1b2c] hover:bg-[#eef1f5]',
    primary: 'bg-[#0e1b2c] text-white hover:bg-[#22344a]',
    danger: 'bg-red-50 text-[#0e1b2c] hover:bg-red-500',
    ghost: 'text-[#5e6b7b] hover:text-[#0e1b2c] hover:bg-[#eef1f5]',
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 disabled:pointer-events-none ${v} ${className}`} />;
}

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-white" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto border-l border-[#dde2e8] bg-white p-4 sm:p-6" role="dialog" aria-label={title}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#0e1b2c]">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 text-[#8a95a3] hover:text-[#0e1b2c]" aria-label="Close">✕</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#dde2e8] py-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-[#0e1b2c]">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-[#8a95a3]">{hint}</p>}
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  AIC_SUPER_ADMIN: 'Super admin',
  AIC_AUDITOR: 'AIC auditor',
  ORG_ADMIN: 'Organisation admin',
  ORG_USER: 'Organisation user',
};

export const ago = (d: string | null) => {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
