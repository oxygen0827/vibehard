"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleStop, FolderKanban, Loader2, MessageSquare, Plus, Send, Terminal, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/utils";

type Project = { id: string; name: string; workspaceKey: string; defaultModel: string };
type Thread = { id: string; title: string; codexThreadId?: string | null };
type AgentEvent = { eventId: string; sequence: number; type: string; data: Record<string, unknown>; timestamp: string };
type Approval = { id: string; tool: string; risk: string; description: string; status: string };
type Model = { id: string; providerId: string; model: string; displayName: string; kind: string };
type Artifact = { id: string; name: string; kind: string; path: string };

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(path), { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "请求失败");
  return data as T;
}

export function AgentWorkbench() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [projectId, setProjectId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [input, setInput] = useState("");
  const [newProject, setNewProject] = useState("");
  const [model, setModel] = useState("gpt-5.6-terra");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([json<{ projects: Project[] }>("/api/projects"), json<{ models: Model[] }>("/api/models")])
      .then(([projectResponse, modelResponse]) => { if (!active) return; setProjects(projectResponse.projects); setModels(modelResponse.models); if (projectResponse.projects[0]) setProjectId(projectResponse.projects[0].id); if (modelResponse.models[0]) setModel(modelResponse.models[0].model); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void json<{ threads: Thread[] }>(`/api/projects/${projectId}/threads`).then((response) => { setThreads(response.threads); if (response.threads[0]) setThreadId(response.threads[0].id); }).catch(() => setThreads([]));
  }, [projectId]);

  useEffect(() => {
    if (!threadId) return;
    let active = true;
    void json<{ events: AgentEvent[]; approvals: Approval[]; artifacts: Artifact[] }>(`/api/threads/${threadId}`)
      .then((response) => { if (!active) return; setEvents(response.events); setApprovals(response.approvals.filter((approval) => approval.status === "pending")); setArtifacts(response.artifacts); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "会话加载失败"); });
    return () => { active = false; };
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    const source = new EventSource(apiPath(`/api/threads/${threadId}/events?after=-1`));
    const eventTypes = ["task.started", "agent.message.delta", "agent.message", "reasoning", "tool.started", "tool.completed", "command.output", "file.changed", "approval.requested", "artifact.created", "task.completed", "task.failed", "task.interrupted"];
    const receive = (message: MessageEvent) => { try { const event = JSON.parse(message.data) as AgentEvent; setEvents((current) => current.some((item) => item.eventId === event.eventId) ? current : [...current, event]); if (event.type === "approval.requested") setApprovals((current) => current.some((item) => item.id === String(event.data.approvalId)) ? current : [...current, { id: String(event.data.approvalId), tool: String(event.data.tool ?? "unknown"), risk: String(event.data.risk ?? "write"), description: String(event.data.description ?? "受限操作"), status: "pending" }]); if (event.type === "artifact.created") void json<{ artifacts: Artifact[] }>(`/api/threads/${threadId}`).then((response) => setArtifacts(response.artifacts)); } catch { /* ignore malformed event */ } };
    eventTypes.forEach((type) => source.addEventListener(type, receive as EventListener));
    return () => { eventTypes.forEach((type) => source.removeEventListener(type, receive as EventListener)); source.close(); };
  }, [threadId]);

  const createProject = async () => {
    if (!newProject.trim()) return;
    try { const slug = newProject.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `project-${Date.now().toString(36)}`; const response = await json<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ name: newProject, workspaceKey: slug }) }); setProjects((current) => [response.project, ...current]); setProjectId(response.project.id); setNewProject(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "项目创建失败"); }
  };

  const createThread = async () => { if (!projectId) return; try { const response = await json<{ thread: Thread }>(`/api/projects/${projectId}/threads`, { method: "POST" }); setThreads((current) => [response.thread, ...current]); setThreadId(response.thread.id); setEvents([]); } catch (reason) { setError(reason instanceof Error ? reason.message : "会话创建失败"); } };
  const send = async () => { if (!threadId || !input.trim()) return; setSending(true); setError(""); try { await json(`/api/threads/${threadId}/turns`, { method: "POST", body: JSON.stringify({ input, model, providerId: models.find((item) => item.model === model)?.providerId }) }); setInput(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "任务提交失败"); } finally { setSending(false); } };
  const decide = async (approvalId: string, decision: "approve" | "reject") => { try { await json(`/api/approvals/${approvalId}/decision`, { method: "POST", body: JSON.stringify({ decision }) }); setApprovals((current) => current.filter((item) => item.id !== approvalId)); } catch (reason) { setError(reason instanceof Error ? reason.message : "审批失败"); } };
  const interrupt = async () => { if (!threadId) return; try { await json(`/api/threads/${threadId}/interrupt`, { method: "POST" }); } catch (reason) { setError(reason instanceof Error ? reason.message : "中断失败"); } };

  const messages = useMemo(() => events.filter((event) => ["task.started", "agent.message", "agent.message.delta", "reasoning", "command.output", "tool.started", "tool.completed", "task.failed"].includes(event.type)), [events]);
  if (loading) return <div className="p-8 text-sm text-muted-foreground">正在连接 Agent 平台...</div>;

  return <div className="grid min-h-full gap-0 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside className="border-r border-border/70 bg-card/40 p-4"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">项目</span><Button size="icon" variant="ghost" className="h-7 w-7" title="新建项目" onClick={createProject}><Plus className="h-4 w-4" /></Button></div><div className="mb-3 flex gap-2"><Input value={newProject} onChange={(event) => setNewProject(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void createProject()} placeholder="项目名称" className="h-8 text-xs" /></div><div className="space-y-1">{projects.map((project) => <button key={project.id} onClick={() => setProjectId(project.id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${project.id === projectId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}><FolderKanban className="h-4 w-4" />{project.name}</button>)}</div>{projects.length === 0 && <p className="text-xs text-muted-foreground">还没有项目</p>}</aside>
    <section className="flex min-h-[620px] flex-col"><div className="flex items-center justify-between border-b border-border/70 px-5 py-3"><div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" /><select value={threadId} onChange={(event) => setThreadId(event.target.value)} className="bg-transparent text-sm font-medium outline-none">{threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}</select><Button size="icon" variant="ghost" className="h-7 w-7" title="新建会话" onClick={createThread}><Plus className="h-4 w-4" /></Button></div><div className="flex items-center gap-2"><Button size="icon" variant="ghost" className="h-7 w-7" title="中断当前任务" onClick={interrupt}><CircleStop className="h-4 w-4" /></Button><select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-xs">{models.map((item) => <option key={item.id} value={item.model}>{item.displayName}</option>)}</select></div></div><div className="flex-1 space-y-3 overflow-y-auto p-5">{messages.length === 0 && <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center text-sm text-muted-foreground"><Terminal className="mb-3 h-8 w-8 text-primary/60" /><p>选择项目并发送第一个 Agent 任务</p><p className="mt-1 text-xs">默认只读，写入和命令执行会请求审批</p></div>}{messages.map((event) => <div key={event.eventId} className={`rounded-lg border p-3 text-sm ${event.type === "command.output" ? "border-border/60 bg-muted/40 font-mono text-xs" : "border-border/70 bg-card"}`}><div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground"><Wrench className="h-3 w-3" />{event.type}</div><p className="whitespace-pre-wrap leading-6">{String(event.data.text ?? event.data.input ?? event.data.message ?? event.data.item?.toString?.() ?? "")}</p></div>)}</div><div className="border-t border-border/70 p-4"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} placeholder="描述要交给 Agent 的任务..." className="min-h-[90px] resize-none" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">Ctrl/⌘ + Enter 发送</span><Button onClick={send} disabled={sending || !threadId || !input.trim()} className="gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? "提交中" : "发送任务"}</Button></div></div></section>
    <aside className="border-l border-border/70 bg-card/30 p-4"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">审批队列</span>{approvals.length > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">{approvals.length}</span>}</div>{error && <div className="mb-3 flex gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError("")}><X className="h-3 w-3" /></button></div>}{approvals.length === 0 ? <p className="text-xs leading-5 text-muted-foreground">当前没有待审批操作</p> : <div className="space-y-3">{approvals.map((approval) => <div key={approval.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" /><div className="min-w-0"><p className="text-xs font-semibold text-foreground">{approval.risk === "write" ? "写入工作区" : "执行命令"}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{approval.description}</p></div></div><div className="mt-3 flex gap-2"><Button size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={() => void decide(approval.id, "approve")}><Check className="h-3 w-3" />允许</Button><Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => void decide(approval.id, "reject")}><CircleStop className="h-3 w-3" />拒绝</Button></div></div>)}</div>}<div className="my-5 border-t border-border/70" /><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">产物</p>{artifacts.length === 0 ? <p className="text-xs text-muted-foreground">暂无产物</p> : <div className="space-y-2">{artifacts.map((artifact) => <div key={artifact.id} className="rounded-md border border-border/70 p-2"><p className="truncate text-xs font-medium">{artifact.name}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{artifact.path}</p></div>)}</div>}</aside>
  </div>;
}
