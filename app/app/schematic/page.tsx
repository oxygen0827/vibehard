"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircuitBoard, Download, FileImage, FileText, FolderOpen, Loader2, ShieldCheck, UploadCloud, X } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ProjectSelector, projectModuleHref } from "@/components/app/project-selector";
import { Button } from "@/components/ui/button";
import { SchematicDocument } from "@/components/app/schematic-document";
import { apiPath } from "@/lib/utils";
import { SCHEMATIC_FILE_LIMIT, schematicResultSchema, type SchematicResult } from "@/lib/agent/schematic";

export default function SchematicPage() {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<SchematicResult | null>(null);
  const [projectId, setProjectId] = useState("");
  const requestId = useRef<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ projectId: string; documentId: string } | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [documentView, setDocumentView] = useState<"document" | "markdown">("document");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const active = useRef<AbortController | null>(null);
  const submission = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); submission.current?.abort(); }, []);
  function selectProject(id: string) {
    if (active.current || submission.current) return;
    setProjectId(id); setResult(null); setSubmitted(null); setError(""); setConsent(false); requestId.current = null;
  }
  function selectFile(next?: File) {
    if (active.current || submission.current) return;
    setResult(null); setSubmitted(null); setError(""); setConsent(false); requestId.current = null;
    if (!next) { setFile(null); return; }
    if (!/\.(png|jpe?g|pdf)$/i.test(next.name) || !next.size || next.size > SCHEMATIC_FILE_LIMIT) {
      setFile(null); setError("请选择不超过 5 MB 的 PNG / JPG / PDF 文件"); return;
    }
    setFile(next);
  }
  async function analyze() {
    if (!file || !consent || !projectId || active.current || submission.current) return;
    const controller = new AbortController(); active.current = controller;
    setAnalyzing(true); setResult(null); setSubmitted(null); setError(""); setDocumentView("document"); setStatus("正在上传并连接模型…");
    try {
      const form = new FormData(); form.set("file", file); form.set("projectId", projectId);
      requestId.current ??= crypto.randomUUID(); form.set("requestId", requestId.current);
      const response = await fetch(apiPath("/api/schematic"), { method: "POST", body: form, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150_000)]) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || "识别请求失败"); }
      if (!response.body) throw new Error("服务器未返回识别内容");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let completed: SchematicResult | null = null;
      while (true) {
        const { value, done } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") setStatus(event.message);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "result") completed = schematicResultSchema.parse(event.result);
        }
        if (done) break;
      }
      if (!completed) throw new Error("连接中断，未收到完整结果；请到项目资料检查是否已归档，也可重试取回同一识别结果");
      if (completed.archive?.projectId !== projectId) throw new Error("服务器未确认归档到所选项目，请刷新后重试");
      setResult(completed);
    } catch (cause) { setError(controller.signal.aborted ? "已取消识别" : cause instanceof Error ? cause.message : "识别失败"); }
    finally { controller.abort(); active.current = null; setAnalyzing(false); setStatus(""); }
  }
  async function submit() {
    if (!result?.archive || submission.current || active.current || submitted) return;
    const targetProjectId = result.archive.projectId;
    const controller = new AbortController(); submission.current = controller;
    setSubmitting(true); setError("");
    try {
      const response = await fetch(apiPath(`/api/projects/${targetProjectId}/knowledge`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", submissionId: result.analysisId, draft: result.draft }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "提交失败");
      if (!body.documents?.some((doc: { id: string }) => doc.id === result.analysisId)) throw new Error("服务器未确认资料保存");
      setSubmitted({ projectId: targetProjectId, documentId: result.analysisId });
    } catch (cause) { if (!controller.signal.aborted) setError(`${cause instanceof Error ? cause.message : "提交失败"}。若网络中断可重试同一申请，不会重复创建或自动发布。`); }
    finally { submission.current = null; setSubmitting(false); }
  }
  function download() {
    if (!result) return;
    const text = `# ${result.draft.title}\n\n来源：${result.draft.source}\n\n${result.draft.content}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "原理图识别-待审核.md"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const busy = analyzing || submitting;
  const nextStep = !projectId ? "先选择工作项目" : !file ? "上传一份清晰图纸" : !consent ? "确认图纸处理授权后开始" : "准备就绪，可以开始识别";
  return <div className="h-full min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="[&>div]:mb-0"><PageHeader helpKey="schematic" icon={CircuitBoard} title="原理图识别" description="把图纸整理成可供 Agent 使用的项目资料，接着推进调试与开发。" /></div>
      <section aria-label="工作项目" className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0 flex-1 sm:max-w-lg"><ProjectSelector value={projectId} onChange={selectProject} disabled={busy} /></div>
        {projectId ? <Link className="inline-flex items-center gap-1 text-sm text-primary" href={projectModuleHref("agent", projectId)}><FolderOpen className="size-4" />查看本项目已归档资料 →</Link> : <Link className="text-sm text-primary" href="/app/agent">前往 Agent 项目创建项目 <ArrowRight className="inline size-4" /></Link>}
      </section>
      <ol aria-label="识别流程" className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-muted-foreground">
        {[["选择工作项目", !!projectId], ["上传并识别", !!result], ["自动归档到项目", !!result?.archive]].map(([label, done], index) => <li key={String(label)} className="flex items-center gap-2"><span className={`flex size-5 items-center justify-center rounded-full ${done ? "bg-primary/10 text-primary" : "bg-muted"}`}>{done ? <Check className="size-3" /> : index + 1}</span>{label}</li>)}
      </ol>
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <section aria-label="图纸上传" className="space-y-5 rounded-xl border bg-card p-5">
            <div><h2 className="text-sm font-semibold">上传原理图</h2><p className="mt-1.5 text-xs leading-5 text-muted-foreground">每次处理一份图纸，识别文档自动保存到所选项目。</p></div>
            <div onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; if (event.dataTransfer.files.length !== 1) { setError("请每次上传一份图纸"); return; } selectFile(event.dataTransfer.files[0]); }} className={`rounded-xl border-2 border-dashed transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-muted/20"}`}>
              <input ref={fileInput} aria-label="上传原理图" tabIndex={-1} type="file" accept=".png,.jpg,.jpeg,.pdf" disabled={busy} onChange={event => selectFile(event.target.files?.[0])} className="sr-only" />
              <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="flex w-full min-w-0 flex-col items-center gap-3 rounded-xl px-4 py-8 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="size-6" /></span>
                <span className="text-sm font-medium">{file ? "更换图纸" : "点击选择文件，或拖到这里"}</span>
                <span className="text-xs text-muted-foreground">PNG / JPG / PDF · 最多 5 MB · PDF 最多 6 页</span>
              </button>
            </div>
            {file && <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-3"><FileImage className="size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={file.name}>{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · 待识别图纸</p></div><Button variant="ghost" size="icon-sm" aria-label="移除图纸" disabled={busy} onClick={() => { selectFile(); if (fileInput.current) fileInput.current.value = ""; }}><X className="size-4" /></Button></div>}
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-6 text-muted-foreground"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} className="mt-1.5 size-4 shrink-0 accent-primary" /><span>我有权处理此图纸，同意将原图私有保存到所选项目，并发送给管理员配置的模型服务进行识别。</span></label>
            <div className="space-y-3 border-t pt-4"><p className="text-xs text-muted-foreground">{nextStep}</p><div className="flex flex-wrap gap-2"><Button size="lg" className="min-w-0 flex-1" onClick={() => void analyze()} disabled={!projectId || !file || !consent || busy}>{analyzing ? <Loader2 className="size-4 animate-spin" /> : <CircuitBoard className="size-4" />}{analyzing ? "识别中…" : "开始识别"}</Button>{analyzing && <Button size="lg" variant="outline" onClick={() => active.current?.abort()}>取消识别</Button>}</div></div>
          </section>
          <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-medium">图纸要求与处理说明</summary><div className="mt-3 space-y-3 text-xs leading-6 text-muted-foreground"><p>首版每项目最多 20 份；复杂图纸建议按页拆分，保持网络标签和引脚清晰。</p><p>暂共用管理台「硬件方案生成」模型配置，服务商和模型需支持图片输入；PDF 会先转成图片。失败会明确报错，不生成示例替代结果。</p><p>识别期间请保持本页打开。中断后可先在项目资料确认是否已归档，再手动重试。</p></div></details>
          <div className="flex items-start gap-2 px-1 text-xs leading-6 text-muted-foreground"><ShieldCheck className="mt-1 size-4 shrink-0" /><p>原图私有保存在 OSS，正文归档到项目。不会自动进入公共知识库。</p></div>
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <section aria-label="识别结果" aria-busy={analyzing} className="min-w-0 overflow-hidden rounded-xl border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><h2 className="text-sm font-semibold">识别文档</h2>{result && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">AI 草案 · 未复核</span>}</div>{result && <Button variant="outline" size="sm" onClick={download}><Download className="size-3.5" />下载识别文档 MD</Button>}</header>
            {!result ? <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 px-6 py-12 text-center sm:min-h-[560px]">{analyzing ? <Loader2 className="size-9 animate-spin text-primary" /> : <span className="flex size-16 items-center justify-center rounded-2xl bg-muted/60"><CircuitBoard className="size-8 text-muted-foreground/60" /></span>}<div><h3 className="text-sm font-medium">{analyzing ? "正在识别图纸" : "图纸变成项目资料，从这里开始"}</h3><p role={analyzing ? "status" : undefined} className="mt-2 max-w-sm text-xs leading-6 text-muted-foreground">{analyzing ? status || "正在等待服务器返回识别结果…" : "选择项目并上传图纸后，这里展示元器件、接口引脚、证据位置与待确认项。"}</p></div>{!analyzing && <p className="text-xs text-muted-foreground">结果自动归档，后续 Agent 可读取</p>}</div> : <>
              <div className="space-y-3 border-b px-5 py-4"><h3 className="break-words text-base font-semibold">{result.draft.title}</h3><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-all text-xs text-muted-foreground">{result.model} · {new Date(result.generatedAt).toLocaleString("zh-CN")}</p><div aria-label="文档视图" className="flex rounded-lg bg-muted/60 p-1">{([['document', '阅读文档'], ['markdown', 'Markdown 原文']] as const).map(([view, label]) => <button key={view} aria-pressed={documentView === view} onClick={() => setDocumentView(view)} className={`rounded-md px-2.5 py-1 text-xs ${documentView === view ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}</div></div></div>
              <div aria-label="识别文档阅读区域" tabIndex={0} className="max-h-[560px] min-h-[300px] overflow-auto overscroll-contain p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">{documentView === "document" ? <SchematicDocument content={result.draft.content} /> : <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 [overflow-wrap:anywhere]">{result.draft.content}</pre>}</div>
              {result.archive && <div role="status" className="space-y-2 border-t bg-primary/5 px-5 py-4"><p className="flex items-start gap-2 text-xs leading-5"><Check className="mt-0.5 size-4 shrink-0 text-primary" />已自动归档到当前项目。Agent 下次任务会先同步并读取这份文档。</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs"><Link href={projectModuleHref("agent", result.archive.projectId)} className="text-primary hover:underline">回到项目并交给 Agent →</Link><a className="text-primary hover:underline" href={apiPath(`/api/projects/${result.archive.projectId}/documents/${result.analysisId}?format=source`)}>下载归档原图</a></div><details className="text-xs text-muted-foreground"><summary className="cursor-pointer">原文件与识别来源</summary><p className="mt-2 break-all">{result.draft.source}</p><p className="mt-1 break-all font-mono">{result.archive.path}</p></details></div>}
            </>}
          </section>
          {result && <><p className="px-1 text-xs leading-6 text-muted-foreground">AI 识别可能误读，不代表电气或实机验证，请对照原图核验。</p><section aria-label="知识库申请" className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">共享到知识库 <span className="ml-1 text-xs font-normal text-muted-foreground">可选</span></h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">项目已归档。申请加入备选后，仍需管理员或开发者审核，不会自动发布。</p></div><Button variant="outline" size="sm" disabled={!result.archive || submitting || !!submitted} onClick={() => void submit()}>{submitting && <Loader2 className="size-3.5 animate-spin" />}{submitting ? "正在提交申请…" : submitted ? "已加入备选" : "申请加入知识库备选"}</Button></div>{submitted && <div role="status" className="space-y-2 rounded-lg bg-primary/5 p-3 text-xs leading-5"><p>已提交到所选项目的待审核列表，等待管理员或开发者审核，尚未成为正式知识。</p><Link className="inline-block text-primary hover:underline" href={`/app/agent/${submitted.projectId}/knowledge?document=${submitted.documentId}`}>查看申请与审核状态 →</Link></div>}</section></>}
        </div>
      </div>
    </div>
  </div>;
}
