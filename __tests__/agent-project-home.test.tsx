import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentWorkbench } from "@/components/app/agent-workbench";

const projectId = "00000000-0000-4000-8000-000000000001";
const designId = "00000000-0000-4000-8000-000000000002";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows an existing project's saved plan and document before a conversation exists", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温湿度监测器", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [{ runnerKey: "cloud-runner", name: "云端", status: "online", capabilities: [] }] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json({ threads: [] });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [{ id: designId, projectId, projectName: "温湿度监测器", requirement: "做一个温湿度监测器", status: "completed", createdAt: "2026-09-29T00:00:00.000Z" }], nextOffset: null });
    throw new Error(`Unexpected request: ${url}`);
  }));

  render(<AgentWorkbench />);
  expect(await screen.findByText("做一个温湿度监测器")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "下载方案 Markdown" })).toHaveAttribute("href", expect.stringContaining(`/api/design/${designId}/download`));
  expect(screen.getByRole("button", { name: "基于最新方案继续" })).toBeEnabled();
  expect(screen.getByText("下一步怎么做")).toBeInTheDocument();
  expect(screen.queryByText("审批队列")).not.toBeInTheDocument();
});

it("starts a conversation from a saved plan without sending a paid task automatically", async () => {
  const threadId = "00000000-0000-4000-8000-000000000003";
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温湿度监测器", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [{ runnerKey: "cloud-runner", name: "云端", status: "online", capabilities: [] }] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json(init?.method === "POST" ? { thread: { id: threadId, title: "新建 Agent 会话" } } : { threads: [] });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [{ id: designId, projectId, projectName: "温湿度监测器", requirement: "做一个温湿度监测器", status: "completed", createdAt: "2026-09-29T00:00:00.000Z" }], nextOffset: null });
    if (url.endsWith(`/api/threads/${threadId}`)) return Response.json({ events: [], approvals: [], artifacts: [] });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });

  render(<AgentWorkbench />);
  fireEvent.click(await screen.findByRole("button", { name: "基于最新方案继续" }));
  await waitFor(() => expect((screen.getByPlaceholderText("描述要交给 Agent 的任务...") as HTMLTextAreaElement).value).toContain("温湿度监测器"));
  expect(screen.getByRole("button", { name: "发送任务" })).toBeEnabled();
  expect(fetcher.mock.calls.some(([url, init]) => url.endsWith(`/api/projects/${projectId}/threads`) && init?.method === "POST")).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith(`/api/threads/${threadId}/turns`))).toBe(false);
});

it("lists actual project artifacts and reuses an existing Agent conversation", async () => {
  const threadId = "00000000-0000-4000-8000-000000000003";
  let connections = 0;
  vi.stubGlobal("EventSource", class { constructor() { connections += 1; } addEventListener() {} close() {} });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") throw new Error("This existing conversation should be reused");
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温湿度监测器", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json({ threads: [{ id: threadId, title: "方案研讨" }] });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [{ id: designId, name: "硬件方案", kind: "design", path: "designs/方案-测试.md" }, { id: "artifact-2", name: "分析报告", kind: "report", path: "reports/分析.md" }] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [{ id: designId, projectId, projectName: "温湿度监测器", requirement: "做一个温湿度监测器", status: "completed", createdAt: "2026-09-29T00:00:00.000Z" }], nextOffset: null });
    if (url.endsWith(`/api/threads/${threadId}`)) return Response.json({ events: [], approvals: [], artifacts: [{ id: designId, name: "硬件方案", kind: "design", path: "designs/方案-测试.md" }, { id: "artifact-2", name: "分析报告", kind: "report", path: "reports/分析.md" }] });
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);

  render(<AgentWorkbench />);
  const files = await screen.findByRole("region", { name: "项目文件" });
  expect(await within(files).findByText("designs/方案-测试.md")).toBeInTheDocument();
  expect(within(files).getByText("reports/分析.md")).toBeInTheDocument();
  expect(connections).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "基于最新方案继续" }));
  await screen.findByRole("button", { name: "发送任务" });
  await waitFor(() => expect(connections).toBe(1));
  expect(fetcher.mock.calls.some(([url, init]) => url.endsWith(`/api/projects/${projectId}/threads`) && init?.method === "POST")).toBe(false);
});

it("guides a project without plans into its first Agent conversation", async () => {
  const threadId = "00000000-0000-4000-8000-000000000004";
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "空项目", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json(init?.method === "POST" ? { thread: { id: threadId, title: "新建 Agent 会话" } } : { threads: [] });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [], nextOffset: null });
    if (url.endsWith(`/api/threads/${threadId}`)) return Response.json({ events: [], approvals: [], artifacts: [] });
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<AgentWorkbench />);
  fireEvent.click(await screen.findByRole("button", { name: "开始 Agent 会话" }));
  expect(await screen.findByText("先描述你希望 Agent 完成的工作，再发送任务。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "发送任务" })).toBeDisabled();
});

it("shows a synced plan file before any Agent conversation has been created", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温湿度监测器", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json({ threads: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [{ id: designId, projectId, projectName: "温湿度监测器", requirement: "做一个温湿度监测器", status: "completed", createdAt: "2026-09-29T00:00:00.000Z" }], nextOffset: null });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [{ id: designId, name: "硬件方案", kind: "design", path: "designs/方案-已同步.md" }] });
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<AgentWorkbench />);
  const files = await screen.findByRole("region", { name: "项目文件" });
  expect(await within(files).findByText("designs/方案-已同步.md")).toBeInTheDocument();
});

it("explains the first step when the account has no Agent project", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [] });
    if (url.endsWith("/api/models")) return Response.json({ models: [] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<AgentWorkbench />);
  expect(await screen.findByText("还没有 Agent 项目")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "先生成硬件方案" })).toHaveAttribute("href", "/app/design");
  expect(screen.queryByRole("button", { name: "发送任务" })).not.toBeInTheDocument();
  expect(screen.queryByText("审批队列")).not.toBeInTheDocument();
});

it("displays service-recorded locked citations in a conversation rather than hiding cached evidence", async () => {
  const threadId = "00000000-0000-4000-8000-000000000003";
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温度项目", defaultModel: "test-model" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", model: "test-model", displayName: "测试模型" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json({ threads: [{ id: threadId, title: "资料分析" }] });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [], nextOffset: null });
    if (url.endsWith(`/api/threads/${threadId}`)) return Response.json({ approvals: [], artifacts: [], events: [{ eventId: "locked-event", sequence: 0, timestamp: "2026-09-30T00:00:00.000Z", type: "knowledge.retrieved", data: {
      origin: "project-material-lock", materialLockState: "active", retrieval: { status: "matched", method: "keyword-chunks-v1", references: [{ id: crypto.randomUUID(), scope: "platform", title: "SHT40 手册", source: "manual.md#part=1", sha256: "a".repeat(64), version: 2, excerpt: "锁定参考" }] },
    } }] });
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<AgentWorkbench />); fireEvent.click(await screen.findByRole("button", { name: "开始 Agent 会话" }));
  const summary = await screen.findByText(/复用已核验项目资料锁/); fireEvent.click(summary);
  expect(screen.getByText("SHT40 手册 · v2")).toBeVisible();
});

it("does not create a duplicate conversation when the existing list cannot be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [{ id: projectId, name: "温湿度监测器", defaultModel: "test-model", runnerKey: "cloud-runner" }] });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model-1", providerId: "test", model: "test-model", displayName: "测试模型", kind: "agent" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [] });
    if (url.endsWith(`/api/projects/${projectId}/threads`)) return Response.json({ error: "会话暂不可用" }, { status: 503 });
    if (url.endsWith(`/api/projects/${projectId}/artifacts`)) return Response.json({ artifacts: [] });
    if (url.includes(`/api/design?projectId=${projectId}`)) return Response.json({ jobs: [{ id: designId, projectId, projectName: "温湿度监测器", requirement: "做一个温湿度监测器", status: "completed", createdAt: "2026-09-29T00:00:00.000Z" }], nextOffset: null });
    throw new Error(`Unexpected request: ${url}`);
  }));
  render(<AgentWorkbench />);
  expect(await screen.findByText("会话列表加载失败，请刷新页面重试。")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "基于最新方案继续" })).toBeDisabled();
});
