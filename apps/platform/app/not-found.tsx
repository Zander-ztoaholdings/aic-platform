'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md bg-aic-paper p-6 md:p-12 rounded-xl border border-aic-black/5 shadow-black/5"
      >
        <div className="w-20 h-20 rounded-full bg-aic-red/10 flex items-center justify-center mx-auto mb-8 border border-aic-red/20">
          <span className="text-3xl">🛡️</span>
        </div>
        
        <h2 className="text-3xl font-serif font-bold text-aic-black mb-4 tracking-tight">
          Resource Restricted.
        </h2>
        
        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10 italic">
          The specific data point or telemetry feed you are attempting to access is currently unreachable or has been archived.
        </p>
        
        <Link 
          href="/"
          className="block w-full inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] text-white text-sm font-medium hover:bg-[#22344a] disabled:opacity-50"
        >
          Return to Intelligence Center
        </Link>
      </motion.div>
      
      <p className="mt-8 text-[12px] text-gray-400 first-cap">
        Status Code: 404 • AIC Pulse v3.1
      </p>
    </div>
  );
}
