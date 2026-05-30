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
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md bg-aic-paper p-12 rounded-[3rem] border border-aic-black/5 shadow-2xl shadow-black/5">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-8 border border-red-100">
          <span className="text-3xl">&#x26A0;</span>
        </div>

        <h2 className="text-3xl font-serif font-bold text-aic-black mb-4 tracking-tight">
          System Error.
        </h2>

        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10 italic">
          The dashboard encountered an unexpected error. This incident has been
          logged to the integrity audit trail.
        </p>

        <button
          onClick={reset}
          className="block w-full py-4 bg-aic-black text-aic-paper font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all rounded-2xl"
        >
          Retry Operation
        </button>
      </div>

      <p className="mt-8 text-[9px] font-mono text-gray-400 uppercase tracking-[0.2em]">
        Status Code: 500 &bull; AIC Pulse v3.1
      </p>
    </div>
  );
}
