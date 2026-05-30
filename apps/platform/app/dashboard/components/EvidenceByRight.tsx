'use client';

import { ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/card';

interface RightEvidence {
  id: number;
  name: string;
  evidenceMet: number;
  evidenceTotal: number;
}

interface EvidenceByRightProps {
  rights: RightEvidence[];
  onViewAll: () => void;
}

export function EvidenceByRight({ rights, onViewAll }: EvidenceByRightProps) {
  return (
    <Card className="p-6 bg-white border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-aic-gold" />
          <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Evidence by Right</span>
        </div>
        <button 
          onClick={onViewAll}
          className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-widest hover:underline flex items-center gap-1"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1 flex-1">
        {rights.map((r) => {
          const pct = Math.round((r.evidenceMet / r.evidenceTotal) * 100);
          const textCol = pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-aic-gold' : 'text-red-600';
          const status = pct === 100 ? 'Complete' : pct >= 50 ? 'In Progress' : 'Required';
          const statusBg = pct === 100 ? 'bg-emerald-50' : pct >= 50 ? 'bg-aic-gold/10' : 'bg-red-50';

          return (
            <button 
              key={r.id} 
              onClick={onViewAll}
              className="w-full flex items-center gap-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors px-2 -mx-2 rounded-lg text-left"
            >
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase tracking-widest flex-shrink-0">R{r.id}</span>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-aic-navy truncate pr-2">{r.name}</span>
                  <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest flex-shrink-0">{r.evidenceMet}/{r.evidenceTotal}</span>
                </div>
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : pct >= 50 ? '#c36c32' : '#ef4444' }} />
                </div>
              </div>

              <div className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${statusBg} ${textCol} flex-shrink-0 w-20 justify-center`}>
                {status}
              </div>
              <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
