"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Only this viewport scrolls. Reading history opts out of following live output. */
export function AgentConversationViewport({ children, revision }: { children: ReactNode; revision: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);

  const followOutput = () => {
    const element = viewport.current;
    if (following.current && element && element.clientHeight > 0) element.scrollTop = element.scrollHeight;
  };

  useLayoutEffect(followOutput, [revision]);
  useEffect(() => {
    const element = viewport.current;
    const onToggle = (event: Event) => {
      if (event.target instanceof HTMLDetailsElement && event.target.open) {
        following.current = false;
        setShowLatest(true);
      }
    };
    element?.addEventListener("toggle", onToggle, true);
    return () => element?.removeEventListener("toggle", onToggle, true);
  }, []);
  useEffect(() => {
    // Includes streaming growth, expanding evidence, and viewport resizing.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(followOutput);
    if (content.current) observer.observe(content.current);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  return <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div ref={viewport} role="region" aria-label="会话消息" tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      onClickCapture={event => {
        // Native toggle is queued after layout; pause before the disclosure grows.
        const details = event.target instanceof Element ? event.target.closest("summary")?.parentElement : null;
        if (details instanceof HTMLDetailsElement && !details.open) {
          following.current = false;
          setShowLatest(true);
        }
      }}
      onScroll={event => {
        const element = event.currentTarget;
        const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 48;
        following.current = nearBottom;
        setShowLatest(!nearBottom);
      }}>
      <div ref={content} className="mx-auto min-h-full w-full max-w-4xl space-y-3 break-words p-4 pb-14 sm:p-5 sm:pb-14 [overflow-wrap:anywhere]">{children}</div>
    </div>
    {showLatest && <Button size="sm" variant="outline" className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 rounded-full bg-background shadow-md"
      onClick={() => { following.current = true; setShowLatest(false); followOutput(); }}>
      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />回到最新
    </Button>}
  </div>;
}
