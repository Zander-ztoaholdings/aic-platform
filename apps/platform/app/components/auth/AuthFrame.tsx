'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * The frame every sign-in, invite, reset and verification screen shares, so
 * they read as one product with the signup wizard: a soft light canvas with a
 * whisper of gold, the wordmark, and a single rounded card.
 */

export const SPRING = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 } as const;

const AIC_WEB = process.env.NEXT_PUBLIC_AIC_WEB_URL || 'https://aiccertified.cloud';

export const inputClass =
  'w-full rounded-2xl bg-[#fafbfc] border border-[#0a1728]/[0.07] px-4 py-3 text-sm text-[#0A1728] ' +
  'placeholder:text-[#b6bdc9] outline-none transition-all duration-200 ' +
  'focus:bg-white focus:border-[#c9920a]/60 focus:ring-4 focus:ring-[#c9920a]/[0.10]';

export const labelClass = 'block text-[11px] font-medium text-[#8a93a3] mb-1.5 tracking-wide';

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        'w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#0A1728] px-5 py-3 text-sm font-medium text-white ' +
        'transition-all duration-200 hover:bg-[#13233b] active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-[#f4f6fa] text-[#4b5566]',
    error: 'bg-red-50 text-red-700',
    success: 'bg-emerald-50 text-emerald-800',
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${styles}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </motion.div>
  );
}

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[linear-gradient(180deg,#fbfcfd_0%,#f2f4f8_100%)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 88% -10%, rgba(201,146,10,0.07), transparent 60%), radial-gradient(50rem 32rem at 5% 105%, rgba(10,23,40,0.05), transparent 65%)',
        }}
      />
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-10 sm:py-14">
        <a href={AIC_WEB} className="mb-8 sm:mb-10" aria-label="AIC — aiccertified.cloud">
          <span className="font-serif text-[22px] font-bold text-[#0A1728] tracking-tight">AIC</span>
          <span className="text-[#c9920a] font-serif text-[22px] font-bold">.</span>
        </a>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
          className="w-full bg-white rounded-[28px] border border-[#0a1728]/[0.05] px-6 sm:px-10 pt-9 pb-8"
          style={{ maxWidth: width, boxShadow: '0 1px 3px rgba(10,23,40,0.04), 0 16px 48px -16px rgba(10,23,40,0.12)' }}
        >
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0A1728]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-[#6b7485]">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </motion.div>

        {footer && <div className="mt-6 text-center text-[13px] text-[#8a93a3]">{footer}</div>}

        <div className="mt-auto pt-10 flex items-center gap-4 text-[12px] text-[#a3abb8]">
          <a href={AIC_WEB} className="hover:text-[#0A1728] transition-colors">aiccertified.cloud</a>
          <span aria-hidden>·</span>
          <Link href="/login" className="hover:text-[#0A1728] transition-colors">Sign in</Link>
          <span aria-hidden>·</span>
          <Link href="/signup" className="hover:text-[#0A1728] transition-colors">Register</Link>
        </div>
      </div>
    </div>
  );
}
