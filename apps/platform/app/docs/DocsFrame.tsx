import Link from 'next/link';
import { DOCS, DOC_GROUPS, type DocBlock } from '@/lib/docs';

/**
 * The docs frame inside the client workspace: contents on the left, the page
 * on the right. Server-rendered; the workspace shell around it handles the
 * session and navigation.
 */
export function DocsFrame({ active, children }: { active?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <nav aria-label="Documentation" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <Link href="/docs" className="mb-4 block text-[15px] font-semibold text-[#0e1b2c] hover:text-[#8a6114]">All docs</Link>
        <div className="space-y-5">
          {DOC_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-[13px] text-[#5e6b7b]">{g}</p>
              <ul className="space-y-0.5">
                {DOCS.filter((d) => d.group === g).map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/docs/${d.slug}`}
                      aria-current={active === d.slug ? 'page' : undefined}
                      className={`block rounded-lg px-2.5 py-1.5 text-[14px] transition-colors ${active === d.slug ? 'border border-[#dde2e8] bg-white font-semibold text-[#0e1b2c]' : 'text-[#2b3a4d] hover:bg-white'}`}
                    >
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">
        {active && (
          <Link href="/docs" className="mb-4 inline-block text-sm font-semibold text-[#8a6114] underline-offset-2 hover:underline lg:hidden">
            All docs
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

export function DocBlockView({ b }: { b: DocBlock }) {
  switch (b.kind) {
    case 'p':
      return <p className="max-w-[68ch] text-[16px] leading-[1.75] text-[#2b3a4d]">{b.text}</p>;
    case 'h':
      return <h2 className="pt-4 text-[1.15rem] font-semibold text-[#0e1b2c]">{b.text}</h2>;
    case 'list':
      return (
        <ul className="max-w-[68ch] list-disc space-y-2 pl-5 marker:text-[#a8772a]">
          {b.items.map((i) => <li key={i} className="text-[16px] leading-[1.7] text-[#2b3a4d]">{i}</li>)}
        </ul>
      );
    case 'steps':
      return (
        <ol className="max-w-[72ch] divide-y divide-[#dde2e8] border-y border-[#dde2e8]">
          {b.items.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3.5">
              <span className="font-semibold tabular-nums text-[#8a6114]">{i + 1}</span>
              <span>
                <span className="block font-semibold text-[#0e1b2c]">{s.title}</span>
                <span className="block text-[15px] leading-[1.6] text-[#5e6b7b]">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      );
    case 'fields':
      return (
        <dl className="max-w-[72ch] divide-y divide-[#dde2e8] border-y border-[#dde2e8]">
          {b.items.map((f) => (
            <div key={f.name} className="grid gap-1 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-5">
              <dt className="break-words text-[15px] font-semibold text-[#0e1b2c]">{f.name}</dt>
              <dd className="text-[15px] leading-[1.6] text-[#5e6b7b]">{f.text}</dd>
            </div>
          ))}
        </dl>
      );
    case 'code':
      return (
        <figure className="max-w-[72ch]">
          <figcaption className="mb-1.5 text-[13px] text-[#5e6b7b]">{b.label}</figcaption>
          <pre className="overflow-x-auto rounded-xl bg-[#0e1b2c] p-5 text-[13px] leading-[1.7] text-[#e6ebf2]"><code>{b.code}</code></pre>
        </figure>
      );
    case 'note':
      return <p className="max-w-[68ch] rounded-xl border border-[#dde2e8] border-l-4 border-l-[#a8772a] bg-white px-5 py-4 text-[15px] leading-[1.65] text-[#2b3a4d]">{b.text}</p>;
  }
}
