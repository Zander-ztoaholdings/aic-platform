'use client';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-4 h-px bg-[#c9920a] flex-shrink-0" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9920a]">
        {children}
      </span>
    </div>
  );
}

export function SectionCard({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-[0_1px_4px_rgba(10,22,40,0.06)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function CopperTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[#c9920a] bg-amber-50 px-2 py-0.5 rounded">
      {children}
    </span>
  );
}
