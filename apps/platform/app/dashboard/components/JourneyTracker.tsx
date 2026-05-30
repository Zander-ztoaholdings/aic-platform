'use client';

import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

interface Stage {
  id: number;
  label: string;
  status: 'past' | 'active' | 'future';
  date?: string;
  progress?: number;
  nextAction?: string;
  cta?: string;
  daysIn?: number;
}

interface JourneyTrackerProps {
  stages: Stage[];
}

export function JourneyTracker({ stages }: JourneyTrackerProps) {
  return (
    <Card className="p-6 bg-white border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-4 h-0.5 bg-aic-gold" />
        <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Certification Journey</span>
      </div>

      <div className="space-y-0 flex-1">
        {stages.map((s, i) => {
          if (s.status === 'past') {
            return (
              <div key={i} className="flex gap-4 items-center py-3 border-b border-gray-50">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-gray-500">{s.label}</span>
                </div>
                <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">{s.date}</span>
              </div>
            );
          }

          if (s.status === 'active') {
            return (
              <div key={i} className="py-5 border-b border-gray-50">
                <div className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-aic-gold flex items-center justify-center flex-shrink-0 shadow-[0_0_0_4px_rgba(195,108,50,0.1)]">
                    <span className="font-mono text-[10px] font-bold text-white">{s.id}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-aic-navy">{s.label}</span>
                      <Badge variant="outline" className="h-4 text-[8px] uppercase font-bold tracking-widest px-1.5 text-aic-gold border-aic-gold/20">
                        Attention
                      </Badge>
                    </div>
                    <div className="h-1 w-full bg-gray-100 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-aic-gold transition-all duration-1000" style={{ width: `${s.progress}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">{s.nextAction}</p>
                    <div className="flex items-center justify-between gap-4">
                      <Button size="sm" className="bg-aic-gold hover:bg-aic-gold-light text-white font-mono text-[10px] uppercase tracking-widest h-8 px-4 rounded-full">
                        {s.cta} <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                      <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">Day {s.daysIn} in stage</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex gap-4 items-center py-3 border-b border-gray-50 last:border-0 opacity-40">
              <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-[10px] font-bold text-gray-300">{s.id}</span>
              </div>
              <span className="text-xs font-bold text-gray-300">{s.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
