"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  /** 目标数值 */
  end: number;
  /** 数字后缀，如 "+" / "%" */
  suffix?: string;
  /** 动画时长（毫秒） */
  duration?: number;
}

/**
 * 进入视口后从 0 滚动到目标值的数字动画。
 * 自动适配 prefers-reduced-motion（直接显示终值）。
 */
export function CountUp({ end, suffix = "", duration = 1400 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      // 减弱动效/不支持 IO 时直接显示终值（异步写入，避免级联渲染）
      const raf = requestAnimationFrame(() => setValue(end));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          // easeOutCubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref}>
      {value}
      {suffix}
    </span>
  );
}
