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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="max-w-md">
        <div className="mb-8">
          <span className="text-4xl md:text-6xl font-bold text-red-500/20">ERR</span>
        </div>

        <h2 className="text-3xl font-serif font-bold text-[#0e1b2c] mb-4 tracking-tight">
          System Error.
        </h2>

        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10">
          An unexpected error occurred in the governance system. This incident
          has been logged for review.
        </p>

        <button
          onClick={reset}
          className="inline-block px-5 md:px-10 py-4 bg-aic-gold text-black text-[12px] font-bold first-cap hover:bg-white transition-all duration-500"
        >
          Retry
        </button>
      </div>

      <p className="mt-12 text-[12px] text-gray-700 first-cap">
        AIC HQ &bull; Corporate Operating System
      </p>
    </div>
  );
}
