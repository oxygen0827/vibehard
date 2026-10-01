"use client";
import { ProjectDocuments } from "@/components/app/project-documents";
import { BrowserDevicePanel } from "@/components/app/browser-device-panel";
import { selectProjectInUrl } from "@/components/app/project-selector";
import { ModuleHelp } from "@/components/app/module-help";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleStop, FolderKanban, Loader2, MessageSquare, Plus, Send, Terminal, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/utils";
import { conversationMessages } from "@/lib/agent/messages";
import { WorkflowEvidence } from "./workflow-evidence";
import { retrievalEvidenceSchema } from "@/lib/agent/retrieval-payload";
import { RetrievalEvidence } from "./retrieval-evidence";
import { AgentReasoning } from "./agent-reasoning";
import { AgentConversationViewport } from "./agent-conversation-viewport";
import { designStatus, type DesignJobSummary } from "@/lib/agent/design-jobs";
import { projectWorkflows, type ProjectWorkflowMode } from "@/lib/agent/project-workflow";

type Project = { id: string; name: string; workspaceKey: string; defaultModel: string; runnerKey?: string | null };
type Thread = { id: string; title: string; codexThreadId?: string | null };
type AgentEvent = { eventId: string; sequence: number; type: string; data: Record<string, unknown>; timestamp: string };
type Approval = { id: string; tool: string; risk: string; description: string; details?: Record<string, unknown>; status: string };
type Model = { id: string; providerId: string; model: string; displayName: string; kind: string };
type Artifact = { id: string; name: string; kind: string; path: string };
type Runner = { runnerKey: string; name: string; status: string; capabilities: string[] };
type ThreadOverview = { events: AgentEvent[]; approvals: Approval[]; artifacts: Artifact[] };
type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";

const EVENT_TYPES = [
  "knowledge.retrieved",
  "task.started", "agent.message.delta", "agent.message", "reasoning", "tool.started", "tool.completed",
  "command.output", "file.changed", "approval.requested", "artifact.created", "task.completed", "task.failed", "task.interrupted",
];

async function json<T>(requestPath: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiPath(requestPath), {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? `请求失败 (${response.status})`);
  return data as T;
}

function approvalFromEvent(event: AgentEvent): Approval {
  return {
    id: String(event.data.approvalId),
    tool: String(event.data.tool ?? "unknown"),
    risk: String(event.data.risk ?? "write"),
    description: String(event.data.description ?? "受限操作"),
    details: event.data,
    status: "pending",
  };
}

function eventText(event: AgentEvent) {
  const direct = event.data.text ?? event.data.input ?? event.data.message;
  if (direct !== undefined) return String(direct);
  const item = event.data.item;
  if (item && typeof item === "object") {
    const typedItem = item as { command?: string; text?: string; type?: string };
    return typedItem.command ?? typedItem.text ?? typedItem.type ?? "";
  }
  return "";
}

export function AgentWorkbench({ mode = "agent" }: { mode?: ProjectWorkflowMode }) {
  const workflow = projectWorkflows[mode];
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [projectId, setProjectId] = useState("");
  const activeProject = useRef("");
  const [threadId, setThreadId] = useState("");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [input, setInput] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newRunnerKey, setNewRunnerKey] = useState("");
  const [modelProfileId, setModelProfileId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState<string[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [error, setError] = useState("");
  const [view, setView] = useState<"overview" | "conversation">("overview");
  const [designs, setDesigns] = useState<DesignJobSummary[]>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState("");
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState("");
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadsError, setThreadsError] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"projects" | "details" | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [documentRevision, setDocumentRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([json<{ projects: Project[] }>("/api/projects"), json<{ models: Model[] }>("/api/models"), json<{ runners: Runner[] }>("/api/runners")])
      .then(([projectResponse, modelResponse, runnerResponse]) => {
        if (!active) return;
        setProjects(projectResponse.projects);
        setModels(modelResponse.models);
        setRunners(runnerResponse.runners);
        setNewRunnerKey(runnerResponse.runners.find((item) => item.runnerKey === "cloud-runner")?.runnerKey ?? runnerResponse.runners[0]?.runnerKey ?? "");
        const requestedProject = new URLSearchParams(window.location.search).get("project");
        const firstProject = requestedProject ? projectResponse.projects.find(project => project.id === requestedProject) : projectResponse.projects[0];
        if (requestedProject && !firstProject) setError("链接中的项目不存在或无权访问，请重新选择项目；不会改用其他项目。");
        if (firstProject) { setThreadsLoading(true); setDesignLoading(true); setArtifactsLoading(true); }
        setProjectId(firstProject?.id ?? "");
        activeProject.current = firstProject?.id ?? "";
        setModelProfileId(modelResponse.models.find((item) => item.model === firstProject?.defaultModel)?.id ?? modelResponse.models[0]?.id ?? "");
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!projectId) return () => { active = false; };
    void json<{ threads: Thread[] }>(`/api/projects/${projectId}/threads`)
      .then((response) => {
        if (!active) return;
        setThreads(response.threads);
        const firstThreadId = response.threads[0]?.id ?? "";
        setThreadId(firstThreadId);
        setConnection(firstThreadId ? "connecting" : "idle");
      })
      .catch(() => { if (active) setThreadsError(true); })
      .finally(() => { if (active) setThreadsLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!projectId) return () => { active = false; };
    void json<{ artifacts: Artifact[] }>(`/api/projects/${projectId}/artifacts`)
      .then(response => { if (active) setArtifacts(response.artifacts); })
      .catch(() => { if (active) setArtifactsError("项目产物暂时无法读取，请稍后刷新页面重试。"); })
      .finally(() => { if (active) setArtifactsLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    if (!projectId) return () => { active = false; };
    void json<{ jobs: DesignJobSummary[] }>(`/api/design?projectId=${encodeURIComponent(projectId)}`)
      .then((response) => { if (active) setDesigns(response.jobs); })
      .catch(() => { if (active) setDesignError("方案记录暂时无法读取，请稍后刷新页面重试。"); })
      .finally(() => { if (active) setDesignLoading(false); });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    let active = true;
    let source: EventSource | undefined;
    if (!threadId || view !== "conversation") return () => { active = false; };
    void json<ThreadOverview>(`/api/threads/${threadId}`)
      .then((response) => {
        if (!active) return;
        setEvents(response.events);
        setApprovals(response.approvals.filter((approval) => approval.status === "pending"));
        const after = response.events.reduce((maximum, event) => Math.max(maximum, event.sequence), -1);
        source = new EventSource(apiPath(`/api/threads/${threadId}/events?after=${after}`));
        source.onopen = () => { if (active) setConnection("connected"); };
        source.onerror = () => { if (active) setConnection("reconnecting"); };
        const receive = (message: MessageEvent) => {
          try {
            const event = JSON.parse(message.data) as AgentEvent;
            setEvents((current) => current.some((item) => item.eventId === event.eventId)
              ? current
              : [...current, event].sort((left, right) => left.sequence - right.sequence));
            if (event.type === "approval.requested") {
              setApprovals((current) => current.some((item) => item.id === String(event.data.approvalId))
                ? current
                : [...current, approvalFromEvent(event)]);
            }
            if (event.type === "artifact.created") {
              void json<{ artifacts: Artifact[] }>(`/api/projects/${projectId}/artifacts`)
                .then(response => { if (active) setArtifacts(response.artifacts); })
                .catch(() => { if (active) setArtifactsError("项目产物刷新失败，请稍后刷新页面。"); });
            }
          } catch {
            setError("收到无法解析的 Agent 事件");
          }
        };
        EVENT_TYPES.forEach((type) => source?.addEventListener(type, receive as EventListener));
      })
      .catch((reason) => {
        if (!active) return;
        setConnection("idle");
        setError(reason instanceof Error ? reason.message : "会话加载失败");
      });

    return () => {
      active = false;
      source?.close();
    };
  }, [threadId, projectId, view]);

  const taskState = useMemo(() => {
    const lifecycle = events.filter((event) => ["task.started", "task.completed", "task.failed", "task.interrupted"].includes(event.type)).at(-1)?.type;
    if (lifecycle === "task.started") return "运行中";
    if (lifecycle === "task.completed") return "已完成";
    if (lifecycle === "task.failed") return "失败";
    if (lifecycle === "task.interrupted") return "已中断";
    return "空闲";
  }, [events]);

  const messages = useMemo(
    () => conversationMessages(events),
    [events],
  );

  const resetThreadData = () => {
    setEvents([]);
    setApprovals([]);
    setConnection("idle");
  };

  const selectProject = (project: Project) => {
    setMobilePanel(null);
    setProjectId(project.id);
    activeProject.current = project.id;
    setView("overview");
    setThreadsLoading(true);
    setDesignLoading(true);
    setArtifactsLoading(true);
    setDesigns([]);
    setArtifacts([]);
    setDesignError("");
    setArtifactsError("");
    setThreadsError(false);
    setError("");
    setThreadId("");
    setInput("");
    setThreads([]);
    resetThreadData();
    const defaultProfile = models.find((item) => item.model === project.defaultModel);
    if (defaultProfile) setModelProfileId(defaultProfile.id);
  };

  const selectThread = (nextThreadId: string) => {
    setThreadId(nextThreadId);
    resetThreadData();
    setConnection(nextThreadId ? "connecting" : "idle");
  };

  const createProject = async () => {
    if (!newProject.trim()) return;
    try {
      const slug = newProject.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `project-${Date.now().toString(36)}`;
      const response = await json<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ name: newProject, workspaceKey: slug, runnerKey: newRunnerKey || undefined }) });
      setProjects((current) => [response.project, ...current]);
      selectProject(response.project);
      setNewProject("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "项目创建失败");
    }
  };

  const createThread = async () => {
    if (!projectId) return null;
    try {
      const response = await json<{ thread: Thread }>(`/api/projects/${projectId}/threads`, { method: "POST" });
      if (activeProject.current !== projectId) return null;
      setThreads((current) => [response.thread, ...current]);
      selectThread(response.thread.id);
      return response.thread;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "会话创建失败");
      return null;
    }
  };

  const openProjectConversation = async (fromLatestDesign = false) => {
    const latest = fromLatestDesign ? designs.find(design => design.status === "completed") : undefined;
    if ((fromLatestDesign && !latest) || threadsLoading || threadsError || openingConversation) return;
    setOpeningConversation(true);
    try {
      const existingThread = threadId || threads[0]?.id;
      if (existingThread) selectThread(existingThread);
      else if (!(await createThread())) return;
      if (activeProject.current !== projectId) return;
      if (latest) setInput(current => current.trim() ? current : `请读取本项目最新完成的硬件方案（需求：${latest.requirement.slice(0, 300)}），先说明方案的关键设计、待核验风险和下一步可执行工作。未经我确认，不要修改工程文件。`);
      setView("conversation");
    } finally { setOpeningConversation(false); }
  };

  const send = async () => {
    const profile = models.find((item) => item.id === modelProfileId);
    if (sending || taskState === "运行中" || !threadId || !input.trim() || !profile) return;
    setSending(true);
    setError("");
    try {
      await json(`/api/threads/${threadId}/turns`, {
        method: "POST",
        body: JSON.stringify({ input, model: profile.model, providerId: profile.providerId }),
      });
      if (activeProject.current === projectId) setInput("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "任务提交失败");
    } finally {
      setSending(false);
    }
  };

  const refreshModels = async () => {
    try {
      const response = await json<{ models: Model[] }>("/api/models");
      setModels(response.models);
      setModelProfileId(response.models[0]?.id ?? "");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "模型列表刷新失败"); }
  };

  const downloadProject = async () => {
    if (!projectId || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(apiPath(`/api/projects/${projectId}/download`));
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "工程下载失败");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `vibehard-${projectId}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "工程下载失败"); }
    finally { setDownloading(false); }
  };

  const decide = async (approvalId: string, decision: "approve" | "reject") => {
    if (deciding.includes(approvalId)) return;
    setDeciding((current) => [...current, approvalId]);
    try {
      await json(`/api/approvals/${approvalId}/decision`, { method: "POST", body: JSON.stringify({ decision }) });
      setApprovals((current) => current.filter((item) => item.id !== approvalId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "审批失败");
    } finally {
      setDeciding((current) => current.filter((item) => item !== approvalId));
    }
  };

  const interrupt = async () => {
    if (!threadId) return;
    try {
      const response = await json<{ interrupted: boolean }>(`/api/threads/${threadId}/interrupt`, { method: "POST" });
      if (!response.interrupted) setError("当前会话没有正在运行的任务");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "中断失败");
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">正在连接 Agent 平台...</div>;

  const connectionLabel = connection === "connected" ? "事件已连接" : connection === "reconnecting" ? "正在重连" : connection === "connecting" ? "正在连接" : "未连接";
  const connectionColor = connection === "connected" ? "bg-emerald-500" : connection === "idle" ? "bg-muted-foreground" : "bg-amber-500";

  return <div aria-label="Agent 项目工作区" className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <header className="shrink-0 space-y-2 border-b bg-card/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3"><h1 className="font-semibold">{workflow.title}</h1><ModuleHelp module={mode} />
        <select aria-label="当前工作项目" className="min-w-0 max-w-full rounded-md border bg-background p-1.5 text-sm" value={projectId}
          disabled={sending || openingConversation || deviceBusy} onChange={event => {
            const project = projects.find(item => item.id === event.target.value);
            if (project) { selectProjectInUrl(project.id); selectProject(project); }
          }}><option value="" disabled>请选择项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        {projectId && <nav aria-label="项目工作入口" className="flex flex-wrap gap-3 text-sm">
          {(["agent", "debug", "embedded"] as const).map(target => <Link key={target} aria-current={target === mode ? "page" : undefined} className="text-primary" href={`/app/${target}?project=${encodeURIComponent(projectId)}`}>{projectWorkflows[target].title}</Link>)}
        </nav>}
      </div>
      {mode !== "agent" && <p className="text-xs text-muted-foreground">与 Agent 项目共用资料、会话、审批和产物。先读取资料制定计划，再确认实际执行；页面不会模拟设备连接、编译或烧录成功。事件连接不代表 USB 已连接。</p>}
    </header>
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2 lg:hidden">
      <Button size="sm" variant="ghost" aria-controls="agent-project-list" aria-expanded={mobilePanel === "projects"} onClick={() => setMobilePanel(current => current === "projects" ? null : "projects")}>项目列表</Button>
      <span className="min-w-0 truncate text-xs text-muted-foreground">{projects.find(project => project.id === projectId)?.name ?? "选择项目"}</span>
      <Button size="sm" variant="ghost" aria-controls="agent-project-details" aria-expanded={mobilePanel === "details"} onClick={() => setMobilePanel(current => current === "details" ? null : "details")}>{error ? "查看错误" : `审批与产物${approvals.length ? ` (${approvals.length})` : ""}`}</Button>
    </div>
    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
    <aside id="agent-project-list" aria-label="项目列表" className={`${mobilePanel === "projects" ? "block" : "hidden"} min-h-0 min-w-0 overflow-y-auto overscroll-contain border-r border-border/70 bg-card/40 p-4 lg:block`}>
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-1"><h2 className="text-sm font-semibold">项目列表</h2></div><Button size="icon" variant="ghost" className="h-7 w-7" title="新建项目" onClick={createProject}><Plus className="h-4 w-4" /></Button></div>
      <div className="mb-2 flex gap-2"><Input value={newProject} onChange={(event) => setNewProject(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void createProject()} placeholder="项目名称" className="h-8 text-xs" /></div>
      <select aria-label="项目执行器" value={newRunnerKey} onChange={(event) => setNewRunnerKey(event.target.value)} className="mb-3 h-8 w-full rounded-md border border-border bg-background px-2 text-xs" disabled={!runners.length}><option value="">暂无可用执行器</option>{runners.map((runner) => <option key={runner.runnerKey} value={runner.runnerKey}>{runner.name}{runner.capabilities.includes("usb-device") ? " · USB 设备" : " · 云端"}</option>)}</select>
      <div className="space-y-1">{projects.map((project) => <button key={project.id} disabled={sending || openingConversation || deviceBusy} onClick={() => { selectProjectInUrl(project.id); selectProject(project); }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${project.id === projectId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}><FolderKanban className="h-4 w-4" /><span className="truncate">{project.name}</span></button>)}</div>
      {projectId && <Link href={`/app/agent/${projectId}/knowledge`} className="mt-3 block rounded-md border p-2 text-center text-sm text-primary">项目知识库 · 审核与版本</Link>}
      {projectId && <Link href={`/app/agent/${projectId}/designs`} className="mt-2 block rounded-md border p-2 text-center text-sm text-primary">方案记录 · 进度与下载</Link>}
      {projects.length === 0 && <p className="text-xs text-muted-foreground">还没有项目</p>}
    </aside>

    <section className={`${mobilePanel ? "hidden" : "flex"} min-h-0 min-w-0 flex-col overflow-hidden lg:flex`}>
      {projectId && <nav aria-label="项目视图" className="flex shrink-0 gap-2 border-b border-border/70 px-5 py-3"><Button size="sm" variant={view === "overview" ? "default" : "ghost"} onClick={() => setView("overview")}>项目概览</Button><Button size="sm" variant={view === "conversation" ? "default" : "ghost"} onClick={() => void openProjectConversation()} disabled={threadsLoading || threadsError || openingConversation}>Agent 会话</Button></nav>}
      {view === "overview" && projectId ? <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5">
        <div><h2 className="text-lg font-semibold">{projects.find(project => project.id === projectId)?.name} · 项目概览</h2><p className="mt-1 text-sm text-muted-foreground">统一查看本项目的方案、原理图资料、调试报告、开发结果与会话记录。各模块选择同一项目后，已归档的工作结果集中保存在这里。</p></div>
        <section aria-label="项目执行准备" className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">{mode === "agent" ? "资料与下一步" : `${workflow.title}准备`}</h3>
          <p className="text-sm text-muted-foreground">Agent 执行器：{runners.find(runner => runner.runnerKey === projects.find(project => project.id === projectId)?.runnerKey)?.name ?? projects.find(project => project.id === projectId)?.runnerKey ?? "未指定"}。{mode === "agent" ? "用于分析项目资料和处理工程任务。项目不限定板型；需要连接硬件时，进入 AI 调试、嵌入式开发或设备开发。" : "提交任务时由服务端核验节点是否可执行；设备连接在本模块单独完成。"}</p>
          <Button disabled={threadsLoading || threadsError || openingConversation} onClick={() => {
            setInput(workflow.prompt);
            void openProjectConversation();
          }}>{workflow.action}</Button>
          <p className="text-xs text-muted-foreground">{mode === "agent" ? "打开会话后检查任务内容并发送，Agent 会读取本项目已归档的资料。" : "只预填任务，不自动调用模型。打开会话检查后发送；设备绑定与实际读写须单独确认。"}</p>
        </section>
        {mode !== "agent" && <BrowserDevicePanel key={`usb-${projectId}`} projectId={projectId} onBusy={setDeviceBusy} onSaved={() => setDocumentRevision(value => value + 1)} onArchived={path => {
          setInput(`请实际使用只读工具读取本项目 ${path}，按报告路径与采集时间说明板型、系统、内存、磁盘和已有服务状态，并结合项目资料给出下一步调试建议。报告是浏览器上报的历史快照，可被伪造，不能代表当前 USB 在线或设备操作授权。此次只分析，不修改文件、部署、复位或烧录。`);
          void openProjectConversation();
        }} />}
        <ProjectDocuments key={`${projectId}-${documentRevision}`} projectId={projectId} disabled={threadsLoading || threadsError || openingConversation || deviceBusy} onAnalyze={() => {
          setInput("请先读取本项目 documents/ 下归档的原理图分析与设备报告，列出外设、接口与引脚、采集时间、来源位置和待确认项，再给出开发调试建议。区分 AI 识别草案与浏览器上报快照，两者不等同于硬件验证。未经我确认不要修改文件或操作设备。");
          void openProjectConversation();
        }} />
        {threadsError && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-600">会话列表加载失败，请刷新页面重试。</p>}
        <section className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">已保存方案</h3><Link className="text-sm text-primary" href={`/app/agent/${projectId}/designs`}>查看全部方案</Link></div>
          {designLoading && <p className="text-sm text-muted-foreground">正在读取方案…</p>}
          {designError && <p role="alert" className="text-sm text-amber-600">{designError}</p>}
          {!designLoading && !designError && designs.length === 0 && <p className="text-sm text-muted-foreground">暂无方案。可先到方案生成提交需求，或直接开始 Agent 会话。</p>}
          <div className="space-y-3">{designs.slice(0, 3).map(design => <div key={design.id} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{designStatus[design.status]} · {new Date(design.createdAt).toLocaleString("zh-CN")}</p><p className="mt-1 break-words text-sm font-medium">{design.requirement}</p><div className="mt-3 flex flex-wrap gap-3 text-sm"><Link href={`/app/agent/${projectId}/designs`} className="text-primary">查看方案记录</Link>{design.status === "completed" && <><a href={apiPath(`/api/design/${design.id}/download`)} className="text-primary">下载方案 Markdown</a><a href={apiPath(`/api/design/${design.id}/materials`)} className="text-primary">下载项目资料包 ZIP</a></>}</div></div>)}</div>
          {designs.some(design => design.status === "completed") && <Button className="mt-4" onClick={() => void openProjectConversation(true)} disabled={threadsLoading || threadsError || openingConversation}>{openingConversation ? "正在打开会话…" : "基于最新方案继续"}</Button>}
          {!designLoading && !designError && designs.length === 0 && <Button className="mt-4" onClick={() => void openProjectConversation()} disabled={threadsLoading || threadsError || openingConversation}>开始 Agent 会话</Button>}
        </section>
        <section aria-label="项目文件" className="rounded-xl border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">项目文件</h3><Button variant="outline" size="sm" disabled={downloading} onClick={() => void downloadProject()}>{downloading ? "打包中…" : "下载工程 ZIP"}</Button></div>
          {artifactsLoading && <p className="text-sm text-muted-foreground">正在读取项目产物…</p>}
          {artifactsError && <p role="alert" className="text-sm text-amber-600">{artifactsError}</p>}
          {artifacts.length > 0 ? <div className="space-y-2">{artifacts.map(artifact => <div key={artifact.id} className="rounded-lg border p-3"><p className="text-sm font-medium">{artifact.name}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{artifact.path}</p></div>)}</div> : !artifactsLoading && !artifactsError && <p className="text-sm text-muted-foreground">暂无已登记的工作区产物。上方已完成的方案可先下载 Markdown；同步到执行器后，方案文件会显示在这里。</p>}
        </section>
      </div> : null}
      {!projectId && <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-6 py-10 text-center"><FolderKanban className="h-10 w-10 shrink-0 text-primary/60" /><h2 className="text-lg font-semibold">还没有 Agent 项目</h2><p className="max-w-md text-sm text-muted-foreground">先在项目列表填写名称并点击＋创建工作区，或在方案生成页提交需求，让平台自动建立项目。</p><Link href="/app/design" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">先生成硬件方案</Link></div>}
      {view === "conversation" && projectId ? <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2"><MessageSquare className="h-4 w-4 shrink-0 text-primary" /><select value={threadId} onChange={(event) => selectThread(event.target.value)} className="min-w-0 max-w-56 bg-transparent text-sm font-medium outline-none" disabled={!threads.length}><option value="">选择会话</option>{threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title}</option>)}</select><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="新建会话" onClick={createThread} disabled={!projectId}><Plus className="h-4 w-4" /></Button></div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${connectionColor}`} /><span>{connectionLabel}</span><span className="border-l border-border pl-2">{taskState}</span><Button size="icon" variant="ghost" className="h-7 w-7" title="中断当前任务" onClick={interrupt} disabled={!threadId}><CircleStop className="h-4 w-4" /></Button><select value={modelProfileId} onChange={(event) => setModelProfileId(event.target.value)} className="max-w-48 rounded-md border border-border bg-background px-2 py-1 text-xs" disabled={!models.length}>{models.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></div>
      </div>
      <div className="flex shrink-0 justify-end border-b border-border/40 px-5 py-1"><button onClick={() => void refreshModels()} className="text-xs text-primary hover:underline">刷新模型列表</button></div>
      <AgentConversationViewport key={threadId} revision={events.at(-1)?.eventId ?? "empty"}>
        {messages.length === 0 && <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-muted-foreground"><Terminal className="mb-3 h-8 w-8 text-primary/60" /><p>选择项目并发送第一个 Agent 任务</p></div>}
        {events.filter(event => event.type === "knowledge.retrieved" && ["platform", "project-material-lock"].includes(String(event.data.origin))).map(event => {
          const parsed = retrievalEvidenceSchema.safeParse(event.data.retrieval);
          return parsed.success ? <details key={event.eventId}><summary className="text-xs">本回合检索 · {event.data.origin === "project-material-lock" ? "复用已核验项目资料锁 · " : ""}{new Date(event.timestamp).toLocaleString()}</summary>
            {event.data.materialLockState && !["active", "absent"].includes(String(event.data.materialLockState)) ? <p className="mt-2 text-xs text-amber-600">项目资料锁不可复用，已改用本回合检索；历史文件不能作为当前有效证据。</p> : null}
            <RetrievalEvidence value={parsed.data} /></details> : null;
        })}
        {messages.map((event) => event.type === "reasoning"
          ? <AgentReasoning key={event.eventId} text={eventText(event)} />
          : <div key={event.eventId} className={`rounded-md border p-3 text-sm ${event.type === "command.output" ? "border-border/60 bg-muted/40 font-mono text-xs" : "border-border/70 bg-card"}`}><div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground"><Wrench className="h-3 w-3" />{event.type}</div><p className="whitespace-pre-wrap break-words leading-6">{eventText(event)}</p><WorkflowEvidence data={event.data} /></div>)}
      </AgentConversationViewport>
      <div aria-label="任务输入区" className="shrink-0 border-t border-border/70 bg-background/95 p-3 sm:p-4"><div className="mx-auto w-full max-w-4xl"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void send(); }} placeholder="描述要交给 Agent 的任务..." className="h-20 min-h-20 resize-none overflow-y-auto sm:h-[90px] sm:min-h-[90px]" /><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{!threadId ? "请先新建或选择会话。" : !modelProfileId ? "请先在管理台配置可用模型。" : !input.trim() ? "先描述你希望 Agent 完成的工作，再发送任务。" : "检查任务内容后点击发送；打开会话本身不会调用模型。"}</p><Button onClick={send} disabled={sending || taskState === "运行中" || !threadId || !input.trim() || !modelProfileId} className="shrink-0 gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{sending ? "提交中" : "发送任务"}</Button></div></div></div>
      </> : null}
    </section>

    <aside id="agent-project-details" aria-label="审批与产物" className={`${mobilePanel === "details" ? "block" : "hidden"} min-h-0 min-w-0 overflow-y-auto overscroll-contain border-l border-border/70 bg-card/30 p-4 lg:block`}>
      {error && <div className="mb-3 flex gap-2 rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{error}<button className="ml-auto" onClick={() => setError("")} title="关闭"><X className="h-3 w-3" /></button></div>}
      {!projectId ? <div className="space-y-3 text-sm"><h3 className="font-semibold">项目与会话</h3><p className="text-muted-foreground">项目用于保存方案、工作区和产物；会话用于围绕该项目持续交给 Agent 任务。创建项目本身不会调用模型。</p></div> : view === "overview" ? <div className="space-y-4 text-sm"><h3 className="font-semibold">下一步怎么做</h3><ol className="list-inside list-decimal space-y-3 text-muted-foreground"><li>在方案生成、原理图识别、AI 调试或嵌入式开发中选择本项目，将工作结果归档到这里。</li><li>点击“让 Agent 分析项目资料”或“基于最新方案继续”，打开会话并预填任务。</li><li>{mode === "agent" ? "需要连接板卡时，前往 AI 调试、嵌入式开发或设备开发；本页集中查看资料与结果。" : "检查任务后自行发送；需要写文件或操作设备时，再核对审批内容。"}</li></ol><p className="rounded-lg border p-3 text-xs text-muted-foreground">私有资料在下次 Agent 任务前同步到工作区；原图从项目资料单独下载。工程 ZIP 包含已同步正文，不重复打包 OSS 原图。</p></div> : <>
      <div className="mb-4 flex items-center justify-between"><span className="text-xs font-semibold uppercase text-muted-foreground">审批队列</span>{approvals.length > 0 && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">{approvals.length}</span>}</div>
      {approvals.length === 0 ? <p className="text-xs leading-5 text-muted-foreground">当前没有待审批操作</p> : <div className="space-y-3">{approvals.map((approval) => {
        const details = approval.details ?? {};
        const pending = deciding.includes(approval.id);
        return <div key={approval.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div className="min-w-0"><p className="text-xs font-semibold text-foreground">{approval.risk === "write" ? "写入工作区" : "执行命令"}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{approval.description}</p>{details.command !== undefined && <p className="mt-2 break-all rounded bg-muted p-2 font-mono text-[10px]">{String(details.command)}</p>}{details.cwd !== undefined && <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">目录: {String(details.cwd)}</p>}{details.targetPath !== undefined && <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">路径: {String(details.targetPath)}</p>}</div></div><div className="mt-3 flex gap-2"><Button size="sm" className="h-7 flex-1 gap-1 text-xs" onClick={() => void decide(approval.id, "approve")} disabled={pending}>{pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}允许</Button><Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={() => void decide(approval.id, "reject")} disabled={pending}><CircleStop className="h-3 w-3" />拒绝</Button></div></div>;
      })}</div>}
      <div className="my-5 border-t border-border/70" /><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase text-muted-foreground">产物</p><Button variant="outline" size="sm" disabled={downloading} onClick={() => void downloadProject()}>{downloading ? "打包中…" : "下载工程"}</Button></div>{artifactsError ? <p role="alert" className="text-xs text-amber-600">{artifactsError}</p> : artifactsLoading ? <p className="text-xs text-muted-foreground">正在读取产物…</p> : artifacts.length === 0 ? <p className="text-xs text-muted-foreground">暂无已登记产物</p> : <div className="space-y-2">{artifacts.map((artifact) => <div key={artifact.id} className="rounded-md border border-border/70 p-2"><p className="truncate text-xs font-medium">{artifact.name}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{artifact.path}</p></div>)}</div>}
      </>}
    </aside>
    </div>
  </div>;
}
