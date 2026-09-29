"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeDocument, KnowledgeVersion } from "@/lib/agent/knowledge";
import type { ChipWebResult } from "@/lib/server/chip-resource-search";

type SharedEntry = { id: string; document: KnowledgeDocument };
type Match = { id: string; version: KnowledgeVersion };

// Match a complete part number. RV1106 must not silently match RV1106B.
function searchPublishedChipKnowledge(entries: SharedEntry[], chip: string): Match[] {
  const needle = chip.trim().toLocaleLowerCase();
  if (!needle) return [];
  return entries.flatMap(entry => {
    const version = entry.document.versions.find(item => item.version === entry.document.publishedVersion);
    if (!version) return [];
    const text = `${version.title} ${version.source} ${version.content}`.toLocaleLowerCase();
    let from = 0;
    while ((from = text.indexOf(needle, from)) !== -1) {
      const before = text[from - 1] ?? "";
      const after = text[from + needle.length] ?? "";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return [{ id: entry.id, version }];
      from += needle.length;
    }
    return [];
  }).slice(0, 20);
}

export default function DatasheetsPage() {
  const [chip, setChip] = useState("");
  const [searchedChip, setSearchedChip] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [webResults, setWebResults] = useState<ChipWebResult[]>([]);
  const [knowledgeMiss, setKnowledgeMiss] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const search = async () => {
    const query = chip.trim();
    if (!query) return;
    const current = ++requestId.current;
    setLoading(true);
    setError("");
    setSearchedChip("");
    setMatches([]);
    setWebResults([]);
    setKnowledgeMiss(false);
    setSearchingWeb(false);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/knowledge/shared`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "资料暂时无法读取");
      if (!Array.isArray(payload.entries)) throw new Error("资料返回格式不正确，请稍后重试");
      if (current !== requestId.current) return;
      const found = searchPublishedChipKnowledge(payload.entries, query);
      setMatches(found);
      setSearchedChip(query);
      if (found.length === 0) {
        setKnowledgeMiss(true);
        setSearchingWeb(true);
        const webResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chips/search`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: query }), cache: "no-store",
        });
        const webPayload = await webResponse.json();
        if (!webResponse.ok) throw new Error(webPayload.error ?? "全网搜索失败");
        if (!Array.isArray(webPayload.results)) throw new Error("全网搜索返回格式不正确");
        if (current !== requestId.current) return;
        setWebResults(webPayload.results);
      }
    } catch (cause) {
      if (current === requestId.current) setError(cause instanceof Error ? cause.message : "资料暂时无法读取");
    } finally {
      if (current === requestId.current) { setLoading(false); setSearchingWeb(false); }
    }
  };

  return <div className="p-6 lg:p-8">
    <PageHeader helpKey="datasheets" icon={BookOpen} title="芯片资料"
      description="按型号查找平台已发布的资料正文，核对来源与版本。" />
    <section className="rounded-xl border border-border/80 bg-card p-5">
      <label htmlFor="chip-model" className="mb-3 block text-sm font-semibold">芯片 / 传感器型号</label>
      <form onSubmit={event => { event.preventDefault(); void search(); }} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="chip-model" value={chip} maxLength={80} onChange={event => {
            setChip(event.target.value);
            ++requestId.current;
            setLoading(false);
            setSearchedChip("");
            setMatches([]);
            setWebResults([]);
            setKnowledgeMiss(false);
            setSearchingWeb(false);
            setError("");
          }} placeholder="输入型号，如 RV1106" className="pl-9" />
        </div>
        <Button type="submit" disabled={!chip.trim() || loading} className="gap-2">
          {loading && <Loader2 className="size-4 animate-spin" />}{loading ? "搜索中..." : "搜索资料"}
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">先检索平台已发布知识；未命中时通过 DeepSeek 云端搜索，按 chip-resource-finder 流程查找网页资料。网页结果尚未解析或核验电气参数。</p>
    </section>

    {error && <p role="alert" className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">{error}</p>}
    {searchedChip && <section aria-label="资料搜索结果" className="mt-6 rounded-xl border border-border/80 bg-card p-5">
      <h2 className="text-sm font-semibold">“{searchedChip}”的已发布资料</h2>
      {knowledgeMiss && <p role="status" className="mt-3 text-sm text-muted-foreground">知识库未找到 {searchedChip} 的已发布资料。{searchingWeb ? "正在搜索厂商产品页、数据手册和开发工具…" : "已转向网页资料搜索。"}</p>}
      {matches.length > 0 && <>
        <p role="status" className="mt-1 text-xs text-muted-foreground">显示 {matches.length} 条匹配正文（最多 20 条）；片段仅供定位，请核对原始资料。</p>
        <div className="mt-4 space-y-3">{matches.map(({ id, version }) => <article key={id} className="rounded-lg border border-border/60 bg-background/70 p-4">
          <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><h3 className="text-sm font-medium">{version.title}</h3></div>
          <p className="mt-2 break-all text-xs text-muted-foreground">来源：{version.source} · 版本 {version.version}</p>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-foreground/80">{version.content.slice(0, 500)}</p>
        </article>)}</div>
      </>}
      {webResults.length > 0 && <div className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">网页检索线索 · 优先显示已识别的厂商域名；请打开原站核对型号、版本和适用范围。</p>
        {webResults.map(result => <article key={result.url} className="rounded-lg border border-border/60 bg-background/70 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{result.kind}</span><span>·</span><span>{result.source}</span><span>·</span><span>{result.host}</span></div>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="mt-2 block break-words text-sm font-medium text-primary hover:underline">{result.title} ↗</a>
          {result.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{result.description}</p>}
        </article>)}
      </div>}
      {knowledgeMiss && !searchingWeb && !error && webResults.length === 0 && <p className="mt-4 text-sm text-muted-foreground">网页搜索也未找到可展示的型号匹配资料。</p>}
      <Link href="/app/knowledge" className="mt-4 inline-block text-xs font-medium text-primary hover:underline">查看知识库 →</Link>
    </section>}
  </div>;
}
