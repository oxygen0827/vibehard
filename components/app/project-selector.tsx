"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/utils";

export function projectModuleHref(module: string, projectId: string) { return `/app/${module}?project=${encodeURIComponent(projectId)}`; }
export function selectProjectInUrl(projectId: string) {
  const url = new URL(window.location.href);
  if (projectId) url.searchParams.set("project", projectId); else url.searchParams.delete("project");
  window.history.replaceState(null, "", url.toString());
}
export function ProjectSelector({ value, onChange, disabled = false }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(apiPath("/api/projects"), { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.projects)) throw new Error("无法读取项目列表");
        if (controller.signal.aborted) return;
        setProjects(body.projects);
      } catch { if (!controller.signal.aborted) setError("项目列表读取失败，请重试"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (loading || error || value) return;
    const requested = new URLSearchParams(window.location.search).get("project");
    if (requested && projects.some(project => project.id === requested)) onChange(requested);
  }, [loading, error, projects, onChange, value]);
  return <div className="space-y-2">
    <label className="block space-y-1 text-sm font-medium"><span>当前项目</span>
      <select aria-label="当前项目" className="block w-full rounded-md border bg-background p-2.5" value={value} disabled={disabled || loading || !!error}
        onChange={event => { selectProjectInUrl(event.target.value); onChange(event.target.value); }}>
        <option value="">{loading ? "正在读取项目…" : "请选择要工作的 Agent 项目"}</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error} <button className="underline" onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}>重试读取项目</button></p>}
    {!loading && !error && !projects.length && <p className="text-sm text-muted-foreground">你还没有项目，请先到 <Link href="/app/agent" className="text-primary underline">Agent 项目创建项目</Link>，再返回选择。</p>}
    <p className="text-xs text-muted-foreground">识别结果只归档到当前选择的项目。分析期间不能切换项目。</p>
  </div>;
}
