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
    <div className="bg-aic-paper p-5 md:p-8 rounded-xl border border-aic-black/5 shadow-lg">
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="text-[12px] font-bold text-[#8a6a1f] first-cap">
            ISO 17024 CPD Portfolio
          </span>
          <h3 className="font-serif text-2xl font-bold mt-2">{label}</h3>
          {sublabel && <p className="text-xs text-gray-500 italic font-serif mt-1">{sublabel}</p>}
        </div>
        <div className="text-right">
          <span className="text-3xl md:text-4xl font-serif font-medium">{progress}%</span>
        </div>
      </div>

      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-aic-black/5">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="h-full bg-white"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="p-4 bg-[#f5f7f9] rounded-2xl border border-aic-black/5">
          <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">Hours Earned</p>
          <p className="text-lg font-serif font-bold">24 / 40</p>
        </div>
        <div className="p-4 bg-[#f5f7f9] rounded-2xl border border-aic-black/5">
          <p className="text-[12px] font-bold text-gray-500 first-cap mb-1">Status</p>
          <p className="text-lg font-serif font-bold text-aic-green first-cap">Compliant</p>
        </div>
      </div>
    </div>
  );
};
