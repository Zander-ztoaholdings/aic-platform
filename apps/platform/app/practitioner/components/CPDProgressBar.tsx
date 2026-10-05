'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface CPDProgressBarProps {
  progress: number; // 0-100
  label: string;
  sublabel?: string;
}

export const CPDProgressBar = ({ progress, label, sublabel }: CPDProgressBarProps) => {
  return (
    <div className="bg-aic-paper/[0.02] p-6 md:p-10 rounded-xl border border-aic-paper/5 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-aic-cyan/5 blur-[80px] rounded-full group-hover:bg-aic-cyan/10 transition-colors" />

      <div className="flex justify-between items-end mb-8 relative z-10">
        <div>
          <span className="flex items-center gap-2 text-[12px] font-bold text-aic-cyan first-cap mb-3">
            <Zap className="w-3 h-3 fill-aic-cyan" />
            ISO 17024 CPD Portfolio
          </span>
          <h3 className="font-serif text-3xl font-bold text-aic-paper leading-tight">{label}</h3>
          {sublabel && <p className="text-xs text-aic-slate italic font-serif mt-2">{sublabel}</p>}
        </div>
        <div className="text-right">
          <span className="text-[2rem] leading-tight md:text-5xl font-serif font-bold text-aic-paper">{progress}%</span>
        </div>
      </div>

      <div className="h-2.5 w-full bg-aic-paper/5 rounded-full overflow-hidden border border-aic-paper/5 p-0.5 relative z-10">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
          className="h-full bg-aic-cyan rounded-full shadow-[0_0_15px_#00F5FF]"
        />
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 md:gap-6 relative z-10">
        <div className="p-4 sm:p-6 bg-aic-paper/[0.02] rounded-2xl border border-aic-paper/5 hover:bg-aic-paper/[0.04] transition-colors">
          <p className="text-[12px] font-bold text-aic-slate first-cap mb-2">Hours Logged</p>
          <p className="text-2xl font-serif font-bold text-aic-paper">26 / 40</p>
        </div>
        <div className="p-4 sm:p-6 bg-aic-paper/[0.02] rounded-2xl border border-aic-paper/5 hover:bg-aic-paper/[0.04] transition-colors">
          <p className="text-[12px] font-bold text-aic-slate first-cap mb-2">Status</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xl font-serif font-bold text-green-500 first-cap tracking-tight">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
};
