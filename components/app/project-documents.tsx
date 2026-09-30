"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/utils";
import type { ProjectDocumentSummary } from "@/lib/agent/project-document";
import { projectModuleHref } from "./project-selector";

export function ProjectDocuments({ projectId, onAnalyze, disabled }: { projectId: string; onAnalyze: () => void; disabled: boolean }) {
  const [documents, setDocuments] = useState<ProjectDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(apiPath(`/api/projects/${projectId}/documents`), { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.documents)) throw new Error(body.error || "资料读取失败");
        if (!controller.signal.aborted) setDocuments(body.documents);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "资料读取失败"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [projectId, reload]);
  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="项目资料">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">项目资料</h3><div className="flex gap-3 text-sm">
      <button className="text-primary" disabled={loading} onClick={() => { setLoading(true); setError(""); setReload(n => n + 1); }}>刷新资料</button>
      <Link href={projectModuleHref("schematic", projectId)} className="text-primary">添加原理图资料 →</Link>
    </div></div>
    <p className="text-xs text-muted-foreground">原图私有存储，正文按统一目录归档。Agent 任务开始前同步读取；不等同于已审核知识库资料。</p>
    {loading ? <p className="text-sm text-muted-foreground">正在读取项目资料…</p> : error ? <p role="alert" className="text-sm text-amber-600">{error}</p> : <>
      {!documents.length && <p className="text-sm text-muted-foreground">暂无项目资料。点击“添加原理图资料”，会自动带上当前项目。</p>}
      {documents.map(doc => <div key={doc.id} className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{doc.title}</p><span className="text-xs text-muted-foreground">{doc.status === "completed" ? doc.syncedAt ? "已归档 · 已同步到工作区" : "已归档 · 下次 Agent 任务前同步" : doc.status === "failed" ? "识别未完成" : "识别处理中 / 等待结果"}</span></div>
        <p className="text-xs text-muted-foreground">{doc.fileName} · {new Date(doc.createdAt).toLocaleString("zh-CN")} · 未人工复核</p>
        {doc.path && <p className="break-all font-mono text-xs text-muted-foreground">{doc.path}</p>}
        {doc.error && <p className="text-xs text-amber-600">{doc.error}</p>}
        {doc.status !== "completed" && <p className="text-xs text-muted-foreground">若识别已中断，可重新选择原文件发起识别；不会自动重试调用模型。</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          {doc.status === "completed" && <a className="text-primary" href={apiPath(`/api/projects/${projectId}/documents/${doc.id}`)}>下载分析文档</a>}
          {doc.originalStored && <a className="text-primary" href={apiPath(`/api/projects/${projectId}/documents/${doc.id}?format=source`)}>下载原图</a>}
        </div>
      </div>)}
      {documents.some(doc => doc.status === "completed") && <Button disabled={disabled} onClick={onAnalyze}>让 Agent 分析项目资料</Button>}
    </>}
  </section>;
}
