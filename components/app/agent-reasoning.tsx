export function AgentReasoning({ text }: { text: string }) {
  return <details className="rounded-md border border-border/70 bg-card text-sm">
    <summary className="cursor-pointer px-3 py-2 text-muted-foreground">推理过程</summary>
    <p className="whitespace-pre-wrap break-words border-t border-border/70 p-3 leading-6">{text}</p>
  </details>;
}
