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

  const baseStyles = "relative px-4 sm:px-6 py-3 rounded-xl text-[12px] font-bold first-cap transition-all duration-300 flex items-center justify-center gap-3 border overflow-hidden group";
  
  const variants = {
    primary: "bg-aic-cyan/10 border-aic-cyan text-[#8a6a1f] hover:bg-aic-cyan/20 hover:shadow-[0_0_20px_rgba(0,245,255,0.3)]",
    secondary: "bg-[#f5f7f9] border-[#dde2e8] text-gray-500 hover:text-[#0e1b2c] hover:border-[#dde2e8]",
    danger: "bg-red-50 border-red-200 text-red-700 hover:bg-red-50 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]",
    ghost: "border-transparent text-gray-500 hover:text-[#8a6a1f] hover:bg-[#eef1f5]",
  };

  const stateStyles = {
    idle: "",
    loading: "cursor-wait opacity-80",
    success: "border-green-200 text-green-700 bg-green-50",
    error: "border-red-200 text-red-700 bg-red-50",
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
