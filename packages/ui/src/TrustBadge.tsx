'use client';

import { useEffect, useState } from 'react';

type TrustStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export default function TrustBadge({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<TrustStatus | null>(null);
  const [tier, setTier] = useState('');

  useEffect(() => {
    // In production, this hits https://api.aic.co.za/v1/verify/{orgId}
    // Mocking the fetch for now
    setTimeout(() => {
        setStatus('ACTIVE');
        setTier('TIER_1');
    }, 1000);
  }, [orgId]);

  if (!status) return <div className="h-12 w-32 bg-gray-100 animate-pulse rounded-md"></div>;

  return (
    <div className="inline-flex items-center gap-3 bg-aic-paper border border-gray-200 px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
        <div className="relative">
            <div className={`h-3 w-3 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className={`absolute inset-0 h-3 w-3 rounded-full ${status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'} animate-ping opacity-75`}></div>
        </div>
        <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest leading-none">AIC Certified</span>
            <span className={`text-sm font-bold font-serif leading-none mt-1 ${status === 'ACTIVE' ? 'text-aic-black' : 'text-red-600'}`}>
                {status === 'ACTIVE' ? `${tier} Compliant` : 'Status Suspended'}
            </span>
        </div>
        {/* Verification Modal Trigger (Invisible Overlay) */}
        <div className="absolute top-full left-0 mt-2 w-64 bg-aic-paper shadow-xl rounded-xl p-4 border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <p className="text-xs text-gray-500 mb-2">Verified by AI Integrity Certification</p>
            <div className="flex justify-between text-xs font-bold border-t pt-2">
                <span>License:</span>
                <span className="font-mono">{orgId}</span>
            </div>
        </div>
    </div>
  );
}
