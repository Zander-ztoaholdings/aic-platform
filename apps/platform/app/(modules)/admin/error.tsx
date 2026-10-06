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
      <div className="max-w-md bg-white p-6 md:p-12 rounded-xl border border-[#dde2e8]">
        <div className="mb-8">
          <span className="text-3xl md:text-4xl text-red-700 font-bold">ERR</span>
        </div>

        <h2 className="text-2xl font-serif font-bold text-[#0e1b2c] mb-4 tracking-tight">
          Something went wrong.
        </h2>

        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10">
          An unexpected error occurred in the admin panel. This incident has
          been logged for investigation.
        </p>

        <button
          onClick={reset}
          className="inline-block px-5 md:px-8 py-3 bg-[#0e1b2c] text-white text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all rounded-lg"
        >
          Try again
        </button>
      </div>

      <div className="mt-12 flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-red-500 animate-pulse"></div>
        <span className="text-[12px] text-gray-700 first-cap">Error Recovery Active</span>
      </div>
    </div>
  );
}
