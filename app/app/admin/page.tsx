"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, CircleX, Clock3, FolderKanban, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/utils";

type Overview = {
  counts: { users: number; projects: number; threads: number; turns: number; activeTurns: number; pendingApprovals: number };
  runners: Array<{ id: string; runnerKey: string; name: string; status: string; capabilities: string[]; lastHeartbeatAt: string | null }>;
  models: Array<{ id: string; providerId: string; model: string; displayName: string; enabled: boolean; capabilities?: string[] }>;
  projects: Array<{ id: string; name: string; workspaceKey: string; runnerKey: string | null; defaultModel: string; userEmail: string; updatedAt: string }>;
  auditLogs: Array<{ id: string; action: string; userEmail: string | null; createdAt: string; metadata: Record<string, unknown> }>;
};

async function loadOverview() {
  const response = await fetch(apiPath("/api/admin/overview"), { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "管理数据加载失败");
  return data as Overview;
}

const date = (value: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "从未连接";
const statusLabel: Record<string, string> = { online: "在线", busy: "工作中", offline: "离线", revoked: "已撤销" };

export default function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = () => { setLoading(true); setError(""); void loadOverview().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "管理数据加载失败")).finally(() => setLoading(false)); };
  useEffect(() => {
    let active = true;
    void loadOverview().then((overview) => { if (active) setData(overview); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "管理数据加载失败"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading && !data) return <div className="p-8 text-sm text-muted-foreground">正在加载平台管理数据...</div>;
  if (error && !data) return <div className="mx-auto max-w-5xl p-8"><div className="rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-500"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div></div>;
  if (!data) return null;
  const cards = [["用户", data.counts.users, Users], ["项目", data.counts.projects, FolderKanban], ["会话", data.counts.threads, Bot], ["任务总数", data.counts.turns, Activity], ["运行中", data.counts.activeTurns, Clock3], ["待审批", data.counts.pendingApprovals, ShieldCheck]] as const;
  return <div className="mx-auto max-w-7xl p-5 sm:p-8">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Platform Control</p><h1 className="text-2xl font-semibold tracking-tight">平台管理</h1><p className="mt-2 text-sm text-muted-foreground">查看 Runner、模型、项目和审计状态。</p></div><Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />刷新</Button></div>
    {error && <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
    <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-6">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-border/70 bg-card/50 p-4"><Icon className="mb-4 h-4 w-4 text-primary" /><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-lg border border-border/70 bg-card/40"><div className="border-b border-border/70 p-5"><h2 className="font-semibold">Runner 节点</h2><p className="mt-1 text-xs text-muted-foreground">工作区执行环境和最近心跳</p></div><div className="divide-y divide-border/60">{data.runners.length === 0 ? <p className="p-5 text-sm text-muted-foreground">暂无 Runner 注册</p> : data.runners.map((runner) => <div key={runner.id} className="flex flex-wrap items-center justify-between gap-3 p-5"><div className="flex min-w-0 items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${runner.status === "online" ? "bg-emerald-500" : runner.status === "busy" ? "bg-amber-500" : "bg-muted-foreground/50"}`} /><div className="min-w-0"><p className="truncate text-sm font-medium">{runner.name}</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{runner.runnerKey}</p></div></div><div className="text-right text-xs"><p className="font-medium">{statusLabel[runner.status] ?? runner.status}</p><p className="mt-1 text-muted-foreground">心跳 {date(runner.lastHeartbeatAt)}</p></div></div>)}</div></section>
      <section className="rounded-lg border border-border/70 bg-card/40"><div className="border-b border-border/70 p-5"><h2 className="font-semibold">模型配置</h2><p className="mt-1 text-xs text-muted-foreground">平台当前可选的模型 Profile</p></div><div className="divide-y divide-border/60">{data.models.map((model) => <div key={model.id} className="flex items-center justify-between gap-3 p-5"><div className="min-w-0"><p className="truncate text-sm font-medium">{model.displayName}</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{model.providerId} / {model.model}</p></div>{model.enabled ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <CircleX className="h-4 w-4 shrink-0 text-muted-foreground" />}</div>)}</div></section>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><section className="rounded-lg border border-border/70 bg-card/40"><div className="border-b border-border/70 p-5"><h2 className="font-semibold">最近项目</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">项目</th><th className="px-5 py-3 font-medium">用户</th><th className="px-5 py-3 font-medium">Runner</th><th className="px-5 py-3 font-medium">更新</th></tr></thead><tbody className="divide-y divide-border/60">{data.projects.length === 0 ? <tr><td colSpan={4} className="px-5 py-5 text-muted-foreground">暂无项目</td></tr> : data.projects.map((project) => <tr key={project.id}><td className="max-w-48 truncate px-5 py-3 font-medium">{project.name}</td><td className="max-w-48 truncate px-5 py-3 text-muted-foreground">{project.userEmail}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{project.runnerKey ?? "未绑定"}</td><td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">{date(project.updatedAt)}</td></tr>)}</tbody></table></div></section>
      <section className="rounded-lg border border-border/70 bg-card/40"><div className="border-b border-border/70 p-5"><h2 className="font-semibold">审计日志</h2></div><div className="divide-y divide-border/60">{data.auditLogs.length === 0 ? <p className="p-5 text-sm text-muted-foreground">暂无审计记录</p> : data.auditLogs.slice(0, 10).map((log) => <div key={log.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-medium">{log.action}</p><time className="shrink-0 text-[10px] text-muted-foreground">{date(log.createdAt)}</time></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{log.userEmail ?? "系统"}</p></div>)}</div></section></div>
  </div>;
}
