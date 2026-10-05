/**
 * Renders a policy's text: "# " and "## " headings, "- " bullets, paragraphs.
 * Built from React elements rather than HTML, so nothing typed into a policy
 * can inject markup.
 */
export function PolicyText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-[#0e1b2c]">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.length === 0) return null;
        if (lines[0].startsWith('# ')) {
          return (
            <div key={i} className="space-y-3">
              <h2 className="font-serif text-[24px] font-semibold">{lines[0].slice(2)}</h2>
              {lines.length > 1 && <PolicyText text={lines.slice(1).join('\n')} />}
            </div>
          );
        }
        if (lines[0].startsWith('## ')) {
          return (
            <div key={i} className="space-y-2 pt-2">
              <h3 className="text-[16px] font-semibold">{lines[0].slice(3)}</h3>
              {lines.length > 1 && <PolicyText text={lines.slice(1).join('\n')} />}
            </div>
          );
        }
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{lines.join(' ')}</p>;
      })}
    </div>
  );
}
