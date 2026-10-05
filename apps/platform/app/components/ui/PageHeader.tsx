import { Eyebrow } from './Eyebrow';

/**
 * The one page heading: where you are, what this page is, one sentence on
 * what it is for, and the page's primary action on the right. Every workspace
 * page uses this so titles sit at the same size and distance on every role.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">{title}</h1>
        {lede && <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
