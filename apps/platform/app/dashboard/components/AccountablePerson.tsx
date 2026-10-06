'use client';

import { ExternalLink, Award } from 'lucide-react';
import { Card } from '../../components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';

interface AccountablePersonProps {
  name: string;
  role: string;
  initials: string;
  caapStatus: 'verified' | 'pending' | 'expired';
  verifiedOn?: string;
}

export function AccountablePerson({ name, role, initials, caapStatus, verifiedOn }: AccountablePersonProps) {
  const statusCol = caapStatus === 'verified' ? 'text-emerald-600' : caapStatus === 'pending' ? 'text-aic-gold' : 'text-red-600';
  const statusBg = caapStatus === 'verified' ? 'bg-emerald-50' : caapStatus === 'pending' ? 'bg-aic-gold/10' : 'bg-red-50';
  const label = caapStatus === 'verified' ? 'CAAP Verified' : caapStatus === 'pending' ? 'CAAP Pending' : 'CAAP Expired';

  return (
    <Card className="p-4 sm:p-6 bg-white border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-4 h-0.5 bg-aic-gold" />
        <span className="text-[12px] font-bold text-aic-gold first-cap">Accountable Person</span>
      </div>

      <div className="flex gap-4 items-start mb-6">
        <div className="w-12 h-12 rounded-xl bg-aic-navy flex items-center justify-center text-sm font-bold text-aic-gold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-aic-navy truncate">{name}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Award className={`w-3.5 h-3.5 ${statusCol}`} />
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px]">
                  <p className="text-[11.5px] leading-relaxed">The Accountable Person is the named individual who holds personal responsibility for every AI decision made in scope.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-gray-400 mb-3">{role}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-bold first-cap ${statusBg} ${statusCol}`}>
              {label}
            </div>
            {verifiedOn && (
              <span className="text-[12px] text-gray-300 first-cap">
                Verified {verifiedOn}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-50 space-y-3">
        <button className="w-full flex items-center justify-between text-[12px] font-bold text-aic-gold first-cap hover:underline text-left">
          View Attestation <ExternalLink className="w-3 h-3" />
        </button>
        {caapStatus === 'pending' && (
          <div className="bg-aic-gold/5 border border-aic-gold/10 rounded-lg p-3">
            <p className="text-[11.5px] text-aic-gold/80 leading-relaxed font-medium">
              CAAP certification launches Q3 2027. Founding partners receive priority enrollment.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
