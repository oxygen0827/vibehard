import { Fragment } from "react";

// A small, text-only renderer for model-produced documents. Never interprets HTML,
// remote images, URLs or directives; the original Markdown remains downloadable.
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : part.startsWith("`") && part.endsWith("`") ? <code key={index} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>
        : <Fragment key={index}>{part}</Fragment>);
}
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
const separator = (line: string) => cells(line).every(cell => /^:?-{3,}:?$/.test(cell));

export function SchematicDocument({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index], key = index;
    if (!line.trim()) { index++; continue; }
    if (line.startsWith("```")) {
      const code: string[] = []; index++;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={key} className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs leading-6"><code>{code.join("\n")}</code></pre>); continue;
    }
    if (line.includes("|") && index + 1 < lines.length && separator(lines[index + 1])) {
      const headers = cells(line), rows: string[][] = []; index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) rows.push(cells(lines[index++]));
      blocks.push(<div key={key} className="max-w-full overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="bg-muted/50"><tr>{headers.map((header, i) => <th key={i} className="min-w-24 border-b px-3 py-2.5 font-semibold"><Inline text={header} /></th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-b last:border-0">{headers.map((_, j) => <td key={j} className="px-3 py-2.5 align-top leading-5"><Inline text={row[j] ?? ""} /></td>)}</tr>)}</tbody></table></div>); continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const Heading = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(<Heading key={key} className="border-b pb-2 pt-2 text-sm font-semibold text-foreground"><Inline text={heading[2]} /></Heading>); index++; continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) quote.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key} className="border-l-2 border-primary/40 bg-primary/5 px-3 py-2 text-xs leading-6 text-muted-foreground"><Inline text={quote.join("\n")} /></blockquote>); continue;
    }
    const ordered = /^\d+\.\s/.test(line), unordered = /^[-*+]\s/.test(line);
    if (ordered || unordered) {
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*+]\s+/;
      const items: string[] = [];
      while (index < lines.length && pattern.test(lines[index])) items.push(lines[index++].replace(pattern, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={key} className={`space-y-1 pl-5 text-sm leading-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((item, i) => <li key={i}><Inline text={item} /></li>)}</List>); continue;
    }
    blocks.push(<p key={key} className="whitespace-pre-wrap text-sm leading-7"><Inline text={line} /></p>); index++;
  }
  return <article aria-label="识别文档正文" className="min-w-0 space-y-4 break-words [overflow-wrap:anywhere]">{blocks}</article>;
}
