'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mb-8">
          <span className="text-6xl font-mono font-bold text-aic-gold/20">404</span>
        </div>

        <h2 className="text-3xl font-serif font-bold text-white mb-4 tracking-tight">
          Resource Not Found.
        </h2>

        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-10">
          The governance resource you are attempting to access does not exist or
          has been archived. Please verify the URL and try again.
        </p>

        <Link
          href="/"
          className="inline-block px-10 py-4 bg-aic-gold text-black font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-white transition-all duration-500"
        >
          Return to HQ
        </Link>
      </div>

      <p className="mt-12 text-[9px] font-mono text-gray-700 uppercase tracking-[0.2em]">
        AIC HQ &bull; Corporate Operating System
      </p>
    </div>
  );
}
