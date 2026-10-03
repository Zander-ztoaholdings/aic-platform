'use client';

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    // Sentence case, no rule, no tracking: a quiet note of where you are,
    // not a label shouting over the heading below it.
    <div className="mb-3 text-[13px] font-medium text-[#8a6a1f]">{children}</div>
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
      className={`bg-white border border-[#dde2e8] rounded-xl p-5 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function CopperTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-[#8a6a1f] bg-[#a8772a]/10 px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}
