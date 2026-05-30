'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md bg-aic-paper p-12 rounded-[3rem] border border-aic-black/5 shadow-2xl shadow-black/5"
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
          className="block w-full py-4 bg-aic-black text-aic-paper font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all rounded-2xl"
        >
          Return to Intelligence Center
        </Link>
      </motion.div>
      
      <p className="mt-8 text-[9px] font-mono text-gray-400 uppercase tracking-[0.2em]">
        Status Code: 404 • AIC Pulse v3.1
      </p>
    </div>
  );
}
