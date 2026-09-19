"use client";
import { useEffect, useRef, useState } from "react";
import { Layers, Loader2, FileDown } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/utils";
import { designResultSchema, type DesignResult } from "@/lib/agent/llm";

const example = "做一个电池供电的温湿度 + 光照监测节点，带小屏幕显示，Wi-Fi 上报数据，支持 USB 充电。";
export default function DesignPage() {
  const [requirement, setRequirement] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [source, setSource] = useState<{ model: string; generatedAt: string; requirement: string } | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const generate = async () => {
    if (generating || requirement.trim().length < 2) return;
    const controller = new AbortController(); active.current = controller;
    setGenerating(true); setResult(null); setSource(null); setError(""); setStatus("正在连接云端模型...");
    try {
      const response = await fetch(apiPath("/api/design"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requirement }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "生成失败"); }
      if (!response.body) throw new Error("服务器未返回内容");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let completed = false;
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") setStatus(event.message);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "result") { setResult(designResultSchema.parse(event.result)); setSource({ model: event.model, generatedAt: event.generatedAt, requirement }); completed = true; }
        }
        if (done) break;
      }
      if (!completed) throw new Error("连接中断，未收到完整方案，请重试");
    } catch (reason) {
      setError(controller.signal.aborted ? "已取消生成" : reason instanceof Error && reason.name === "TimeoutError" ? "生成超时，请检查模型服务后重试" : reason instanceof Error ? reason.message : "生成失败");
    } finally { controller.abort(); active.current = null; setGenerating(false); setStatus(""); }
  };
  const download = () => {
    if (!result || !source) return;
    const text = ["# 硬件方案草案", `模型：${source.model}`, `时间：${source.generatedAt}`, `需求：${source.requirement}`, "未经过知识库检索、数据手册核验或电气验证。", "## 架构", ...result.architecture.map((x) => `- ${x}`), "## BOM", ...result.bom.map((x) => `- ${x.item}：${x.model} × ${x.qty}；${x.estCost}`), "## 接口", ...result.interfaces.map((x) => `- ${x}`), "## 风险", ...result.risks.map((x) => `- [${x.level}] ${x.desc}`)].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "硬件方案草案.md"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="p-6 lg:p-8">
    <PageHeader icon={Layers} title="硬件方案生成" description="根据需求调用云端 LLM，生成架构、BOM、接口规划和风险建议" />
    <div className="rounded-xl border border-border/80 bg-card p-5">
      <div className="mb-3 flex items-center justify-between"><label htmlFor="requirement" className="text-sm font-semibold">功能需求</label><button disabled={generating} onClick={() => setRequirement(example)} className="text-xs font-medium text-primary hover:underline">填入示例</button></div>
      <Textarea id="requirement" value={requirement} disabled={generating} maxLength={12000} onChange={(e) => setRequirement(e.target.value)} placeholder="描述功能、供电、通信、尺寸等约束..." className="min-h-[140px]" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">直接调用管理员配置的模型，当前不接入知识库。</span><div className="flex gap-2">{generating && <Button variant="outline" onClick={() => active.current?.abort()}>取消</Button>}<Button onClick={() => void generate()} disabled={requirement.trim().length < 2 || generating} className="gap-2">{generating && <Loader2 className="h-4 w-4 animate-spin" />}{generating ? "生成中..." : "生成方案"}</Button></div></div>
      {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
    {result && source && <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4"><div><p className="text-sm">AI 方案草案 · {source.model} · {new Date(source.generatedAt).toLocaleString("zh-CN")}</p><p className="mt-1 text-xs text-muted-foreground">尚未核对数据手册、价格和引脚，不代表已通过 ERC 或硬件验证。</p></div><Button variant="outline" onClick={download}><FileDown className="mr-2 h-4 w-4" />下载方案</Button></div>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">架构建议</h2><ul className="list-disc space-y-2 pl-5 text-sm">{result.architecture.map((x, i) => <li key={i}>{x}</li>)}</ul></section>
      <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">BOM 建议</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">器件</th><th className="p-2">候选型号</th><th className="p-2">数量</th><th className="p-2">价格参考</th></tr></thead><tbody>{result.bom.map((b, i) => <tr key={i} className="border-b border-border/50"><td className="p-2">{b.item}</td><td className="p-2">{b.model}</td><td className="p-2">{b.qty}</td><td className="p-2">{b.estCost}</td></tr>)}</tbody></table></div></section>
      <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">接口规划</h2><ul className="list-disc space-y-2 pl-5 text-sm">{result.interfaces.map((x, i) => <li key={i}>{x}</li>)}</ul></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">风险与待验证项</h2><ul className="space-y-3 text-sm">{result.risks.map((r, i) => <li key={i}><span className="mr-2 font-semibold">[{r.level}]</span>{r.desc}</li>)}</ul></section></div>
    </div>}
  </div>;
}
