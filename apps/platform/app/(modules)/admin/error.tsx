'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-[#1c1c1c] p-12 rounded-3xl border border-white/5 shadow-2xl">
        <div className="mb-8">
          <span className="text-4xl text-red-500 font-mono font-bold tracking-tighter">ERR</span>
        </div>

        <h2 className="text-2xl font-serif font-bold text-white mb-4 tracking-tight">
          System Fault Detected.
        </h2>

        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10">
          An unexpected error occurred in the admin panel. This incident has
          been logged for investigation.
        </p>

        <button
          onClick={reset}
          className="inline-block px-8 py-3 bg-blue-600 text-white font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-blue-500 transition-all rounded-lg"
        >
          Retry Operation
        </button>
      </div>

      <div className="mt-12 flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-red-500 animate-pulse"></div>
        <span className="text-[8px] font-mono text-gray-700 uppercase tracking-[0.4em]">Error Recovery Active</span>
      </div>
    </div>
  );
}
