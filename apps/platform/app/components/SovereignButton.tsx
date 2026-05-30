'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface SovereignButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  state?: ButtonState;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SovereignButton = ({
  variant = 'primary',
  state = 'idle',
  className,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: SovereignButtonProps) => {
  const isBusy = state === 'loading' || state === 'success' || state === 'error';

  const baseStyles = "relative px-6 py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-3 border overflow-hidden group";
  
  const variants = {
    primary: "bg-aic-cyan/10 border-aic-cyan text-aic-cyan hover:bg-aic-cyan/20 hover:shadow-[0_0_20px_rgba(0,245,255,0.3)]",
    secondary: "bg-aic-paper/5 border-aic-paper/10 text-gray-400 hover:text-aic-paper hover:border-aic-paper/30",
    danger: "bg-red-500/10 border-red-500/50 text-red-500 hover:bg-red-500/20 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    ghost: "border-transparent text-gray-500 hover:text-aic-cyan hover:bg-aic-paper/5",
  };

  const stateStyles = {
    idle: "",
    loading: "cursor-wait opacity-80",
    success: "border-green-500 text-green-500 bg-green-500/10",
    error: "border-red-500 text-red-500 bg-red-500/10",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], stateStyles[state], className)}
      disabled={isBusy || disabled}
      {...props}
    >
      <AnimatePresence mode="wait">
        {state === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-0 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>VERIFIED</span>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute inset-0 flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            <span>FAILED</span>
          </motion.div>
        )}

        {state === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            {leftIcon}
            <span>{children}</span>
            {rightIcon}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanline Effect for Primary Buttons */}
      {variant === 'primary' && state === 'idle' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-aic-paper/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
      )}
    </button>
  );
};
