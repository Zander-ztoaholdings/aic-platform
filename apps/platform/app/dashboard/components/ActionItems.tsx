'use client';

import { ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

interface ActionItem {
  id: number;
  urgency: 'high' | 'medium' | 'low';
  title: string;
  why: string;
  deadline: string;
  cta: string;
}

interface ActionItemsProps {
  items: ActionItem[];
  onAction: (id: number, cta: string) => void;
}

export function ActionItems({ items, onAction }: ActionItemsProps) {
  const urgCol = { high: 'text-red-600', medium: 'text-aic-gold', low: 'text-gray-400' };
  const urgBg = { high: 'bg-red-50', medium: 'bg-aic-gold/10', low: 'bg-gray-50' };
  const urgBorder = { high: 'border-red-600', medium: 'border-aic-gold', low: 'border-gray-300' };

  return (
    <Card className="p-6 bg-white border-gray-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-4 h-0.5 bg-aic-gold" />
        <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Action Items</span>
      </div>

      <div className="space-y-3 flex-1">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-aic-navy mb-1">All caught up</h3>
            <p className="text-xs text-gray-400">Next milestone in 14 days.</p>
          </div>
        ) : (
          items.map((a) => {
            const uc = urgCol[a.urgency];
            const ub = urgBg[a.urgency];
            const ubd = urgBorder[a.urgency];

            return (
              <div 
                key={a.id} 
                className={`bg-gray-50/50 border border-gray-100 rounded-xl p-4 border-l-4 ${ubd.replace('border-', 'border-l-')}`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-xs font-bold text-aic-navy leading-snug">{a.title}</h3>
                  <Badge 
                    variant="outline" 
                    className={`h-4 text-[8px] uppercase font-bold tracking-widest px-1.5 border-none ${ub} ${uc}`}
                  >
                    {a.urgency}
                  </Badge>
                </div>
                
                <p className="text-[11px] text-gray-500 mb-4 leading-relaxed line-clamp-2">{a.why}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-300" />
                    <span className="font-mono text-[9px] text-gray-400 uppercase tracking-widest">Due {a.deadline}</span>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => onAction(a.id, a.cta)}
                    className="bg-aic-gold hover:bg-aic-gold-light text-white font-mono text-[9px] uppercase tracking-widest h-7 px-3 rounded-full"
                  >
                    {a.cta === 'Evidence Vault' ? 'Upload Evidence' : 'Reply to Auditor'} <ChevronRight className="w-2.5 h-2.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
