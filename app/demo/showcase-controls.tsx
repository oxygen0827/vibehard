"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { assetPath } from "@/lib/utils";
import styles from "./showcase.module.css";

export function ChapterNav({ chapters }: { chapters: { id: string; label: string }[] }) {
  const [active, setActive] = useState(chapters[0].id);
  const nav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = window.innerHeight * 0.4;
      let current = chapters[0].id;
      for (const chapter of chapters) {
        if ((document.getElementById(chapter.id)?.getBoundingClientRect().top ?? Infinity) <= target) current = chapter.id;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [chapters]);
  useEffect(() => {
    const container = nav.current;
    const link = container?.querySelector<HTMLElement>(`[href="#${active}"]`);
    if (!container || !link) return;
    const offset = link.getBoundingClientRect().left - container.getBoundingClientRect().left;
    if (offset < 0 || offset + link.offsetWidth > container.clientWidth) {
      container.scrollTo({ left: container.scrollLeft + offset - (container.clientWidth - link.offsetWidth) / 2 });
    }
  }, [active]);
  return (
    <nav className={styles.chapterNav} aria-label="演示流程">
      <div ref={nav} className={styles.chapterNavInner}>
        {chapters.map((chapter, index) => (
          <a key={chapter.id} href={`#${chapter.id}`} aria-current={active === chapter.id ? "step" : undefined}>
            <span>{String(index + 1).padStart(2, "0")}</span>{chapter.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);
  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = "";
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
    } catch {
      if (navigator.share) {
        try { await navigator.share({ title: "VibeHard 产品实录", url: url.href }); } catch { /* A dismissed share sheet needs no error. */ }
      } else window.prompt("分享链接", url.href);
    }
  };
  return <button type="button" className={styles.shareButton} onClick={share} title={copied ? "链接已复制" : "复制分享链接"} aria-label={copied ? "链接已复制" : "复制分享链接"}>{copied ? <Check size={17} /> : <Share2 size={17} />}<span aria-live="polite">{copied ? "已复制" : "分享"}</span></button>;
}

export function DemoPlayer({ slug, label, index }: { slug: string; label: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const original = assetPath(`/demo/recordings/${slug}.gif`);

  return (
    <div className={styles.player}>
      <div className={styles.playerHeader}><span><span className={styles.recordingDot} />产品实录 <span className={styles.headerDivider}>/</span> {label}</span><span className={styles.counter}>{String(index).padStart(2, "0")} / 05</span></div>
      <div className={styles.videoSurface}>
        <img src={original} alt={`${label}操作实录`} width={1600} height={900} loading="lazy" decoding="async" onError={() => setFailed(true)} />
        {failed && <div className={styles.videoError} role="status">视频暂时无法播放 <a href={original}>查看原始 GIF <Download size={14} /></a></div>}
      </div>
      <noscript><a className={styles.fallbackLink} href={original}>查看{label}原始 GIF</a></noscript>
    </div>
  );
}
