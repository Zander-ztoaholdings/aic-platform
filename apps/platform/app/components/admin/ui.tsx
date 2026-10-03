'use client';

/**
 * Small, shared pieces for the staff admin screens. Quiet on purpose: the
 * information is the design here, not the chrome.
 */

export const field =
  'w-full rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[#d9a53a] focus:ring-2 focus:ring-[#d9a53a]/20';

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'gold'; children: React.ReactNode }) {
  const t = {
    neutral: 'bg-white/[0.07] text-white/70',
    good: 'bg-emerald-400/12 text-emerald-300',
    warn: 'bg-amber-400/12 text-amber-300',
    bad: 'bg-red-400/12 text-red-300',
    gold: 'bg-[#d9a53a]/15 text-[#e8c071]',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Button({ variant = 'default', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  const v = {
    default: 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]',
    primary: 'bg-[#d9a53a] text-[#0b1626] hover:bg-[#e8b54a]',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
    ghost: 'text-white/60 hover:text-white hover:bg-white/[0.06]',
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40 disabled:pointer-events-none ${v} ${className}`} />;
}

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0d1a2c] p-6 shadow-2xl" role="dialog" aria-label={title}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md px-2 text-white/50 hover:text-white" aria-label="Close">✕</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/[0.08] py-5 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-white/50">{hint}</p>}
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
