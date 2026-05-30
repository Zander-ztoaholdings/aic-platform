'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CPDProgressBarProps {
  progress: number; // 0-100
  label: string;
  sublabel?: string;
}

export const CPDProgressBar = ({ progress, label, sublabel }: CPDProgressBarProps) => {
  return (
    <div className="bg-aic-paper p-8 rounded-[2.5rem] border border-aic-black/5 shadow-lg">
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.3em]">
            ISO 17024 CPD Portfolio
          </span>
          <h3 className="font-serif text-2xl font-bold mt-2">{label}</h3>
          {sublabel && <p className="text-xs text-gray-400 italic font-serif mt-1">{sublabel}</p>}
        </div>
        <div className="text-right">
          <span className="text-4xl font-serif font-medium">{progress}%</span>
        </div>
      </div>

      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-aic-black/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="h-full bg-aic-black"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="p-4 bg-aic-paper/50 rounded-2xl border border-aic-black/5">
          <p className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Hours Earned</p>
          <p className="text-lg font-serif font-bold">24 / 40</p>
        </div>
        <div className="p-4 bg-aic-paper/50 rounded-2xl border border-aic-black/5">
          <p className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
          <p className="text-lg font-serif font-bold text-aic-green uppercase">Compliant</p>
        </div>
      </div>
    </div>
  );
};
