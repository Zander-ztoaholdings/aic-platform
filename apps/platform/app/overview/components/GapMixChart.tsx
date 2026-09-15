'use client';

/**
 * Split out of overview/page.tsx (a Server Component) because it did not
 * have its own 'use client' boundary while importing recharts' Pie/PieChart/
 * Cell directly. 'use client' is a per-file directive, not per-function -
 * defining this inside page.tsx meant recharts was being pulled into the
 * server/RSC bundle, which broke the production build at "Collecting page
 * data" with `TypeError: createContext is not a function` (recharts creates
 * React context at module scope; that only works in a client bundle).
 * components/ui/chart.tsx already gets this right (see its own 'use client'
 * line) - this file follows the same pattern.
 */

import { Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../../components/ui/chart';
import type { Gap } from '../../../lib/org-overview';
import { SEVERITY_DOT, SEVERITY_LABEL, SEVERITY_CHART_COLOR } from '../severity';

export function GapMixChart({ gaps }: { gaps: Gap[] }) {
  const counts: Record<Gap['severity'], number> = { BLOCKING: 0, MATERIAL: 0, ADVISORY: 0 };
  for (const g of gaps) counts[g.severity] += 1;
  const data = (Object.keys(counts) as Gap['severity'][])
    .filter((s) => counts[s] > 0)
    .map((s) => ({ severity: SEVERITY_LABEL[s], value: counts[s], key: s }));

  const config: ChartConfig = {
    value: { label: 'Gaps' },
    BLOCKING: { label: 'Blocking', color: SEVERITY_CHART_COLOR.BLOCKING },
    MATERIAL: { label: 'Material', color: SEVERITY_CHART_COLOR.MATERIAL },
    ADVISORY: { label: 'Advisory', color: SEVERITY_CHART_COLOR.ADVISORY },
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[160px] text-center">
        <div className="size-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
          0
        </div>
        <p className="mt-3 text-xs text-gray-400">No open gaps.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <ChartContainer config={config} className="h-[160px] w-[160px] aspect-square shrink-0">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="severity" innerRadius={44} outerRadius={70} strokeWidth={3}>
            {data.map((d) => (
              <Cell key={d.key} fill={SEVERITY_CHART_COLOR[d.key]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className={`size-2.5 rounded-full ${SEVERITY_DOT[d.key]}`} />
            <span className="text-gray-600">{d.severity}</span>
            <span className="font-mono font-bold text-aic-navy tabular-nums">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
