'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface EmpathySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const EmpathySlider = ({ value, onChange }: EmpathySliderProps) => {
  const getThemeColor = (v: number) => {
    if (v <= 3) return 'bg-teal-500';
    if (v <= 7) return 'bg-amber-600';
    return 'bg-red-700';
  };

  const getLabel = (v: number) => {
    if (v <= 3) return 'Low Human Impact';
    if (v <= 7) return 'Moderate Impact - Exercise Caution';
    return 'High Human Impact - Critical Empathy Mode';
  };

  return (
    <div className="flex flex-col space-y-4 w-full max-w-md bg-aic-paper/10 backdrop-blur-md p-6 rounded-2xl border border-aic-paper/20">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">
          Human Impact Magnitude
        </span>
        <motion.span 
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "px-3 py-1 rounded-full text-aic-paper text-[10px] font-bold font-mono transition-colors duration-500",
            getThemeColor(value)
          )}
        >
          {value} / 10
        </motion.span>
      </div>
      
      <input
        type="range"
        min="1"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-current transition-all duration-500"
        style={{ color: value <= 3 ? '#14b8a6' : value <= 7 ? '#d97706' : '#b91c1c' }}
      />

      <p className="text-[11px] italic font-serif text-gray-500 text-center">
        {getLabel(value)}
      </p>
    </div>
  );
};
