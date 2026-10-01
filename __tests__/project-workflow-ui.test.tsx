import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentWorkbench } from "@/components/app/agent-workbench";
import { projectWorkflows } from "@/lib/agent/project-workflow";

const id = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002", thread = "00000000-0000-4000-8000-000000000003";
function setup() {
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [id, other].map((id, index) => ({ id, name: `项目${index + 1}`, runnerKey: "cloud-runner", defaultModel: "test" })) });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model", providerId: "test", model: "test", displayName: "Test" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [{ runnerKey: "cloud-runner", name: "云端节点", status: "online", capabilities: [] }] });
    if (url.endsWith("/threads")) return Response.json(init?.method === "POST" ? { thread: { id: thread, title: "真实会话" } } : { threads: [] });
    if (url.endsWith("/artifacts")) return Response.json({ artifacts: [] });
    if (url.endsWith("/documents")) return Response.json({ documents: [] });
    if (url.includes("/api/design?")) return Response.json({ jobs: [] });
    if (url.endsWith(`/api/threads/${thread}`)) return Response.json({ events: [], approvals: [], artifacts: [] });
    if (url.endsWith("/turns")) return Response.json({ turn: { id: "turn" } });
    throw new Error(`Unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetcher); return fetcher;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
it.each(["debug", "embedded"] as const)("%s uses the selected real project, requires explicit send and shares module links", async mode => {
  window.history.replaceState(null, "", `/?project=${other}`);
  const fetcher = setup(); render(<AgentWorkbench mode={mode} />);
  const selector = await screen.findByRole("combobox", { name: "当前工作项目" });
  expect(selector).toHaveValue(other);
  expect(screen.getByRole("link", { name: "Agent 项目" })).toHaveAttribute("href", `/app/agent?project=${other}`);
  expect(screen.getByText(/事件连接不代表 USB 已连接/)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "浏览器 USB 设备" })).toBeInTheDocument();
  const prepare = screen.getByRole("button", { name: projectWorkflows[mode].action });
  await waitFor(() => expect(prepare).toBeEnabled()); fireEvent.click(prepare);
  const send = await screen.findByRole("button", { name: "发送任务" });
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(0);
  expect(screen.getByPlaceholderText("描述要交给 Agent 的任务...")).toHaveValue(projectWorkflows[mode].prompt);
  fireEvent.click(send);
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(1));
  const creation = fetcher.mock.calls.find(([url, init]) => url.endsWith("/threads") && init?.method === "POST");
  expect(creation?.[0]).toContain(`/projects/${other}/threads`);
});
it("keeps the Agent project independent of board connection controls", async () => {
  window.history.replaceState(null, "", `/?project=${other}`);
  const fetcher = setup(); render(<AgentWorkbench />);
  await screen.findByRole("region", { name: "项目执行准备" });
  expect(screen.getByRole("combobox", { name: "当前工作项目" })).toHaveValue(other);
  expect(screen.queryByRole("region", { name: "浏览器 USB 设备" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "USB 连接并归档只读报告" })).not.toBeInTheDocument();
  expect(screen.getByText(/项目不限定板型/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "AI 调试" })).toHaveAttribute("href", `/app/debug?project=${other}`);
  expect(screen.getByRole("link", { name: "嵌入式开发" })).toHaveAttribute("href", `/app/embedded?project=${other}`);
  await screen.findByText(/暂无项目资料/);
  expect(fetcher.mock.calls.filter(([url]) => url.includes("device-reports"))).toHaveLength(0);
});
it("does not silently switch an inaccessible URL to another project", async () => {
  window.history.replaceState(null, "", "/?project=not-my-project"); const fetcher = setup();
  render(<AgentWorkbench mode="debug" />);
  expect(await screen.findByRole("combobox", { name: "当前工作项目" })).toHaveValue("");
  expect(screen.getByText(/链接中的项目不存在或无权访问/)).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("/threads"))).toBe(false);
});
it("clears an unsent task when switching projects", async () => {
  setup(); render(<AgentWorkbench mode="debug" />);
  const prepare = await screen.findByRole("button", { name: "准备外设调试清单" });
  await waitFor(() => expect(prepare).toBeEnabled()); fireEvent.click(prepare);
  await screen.findByRole("button", { name: "发送任务" });
  fireEvent.change(screen.getByRole("combobox", { name: "当前工作项目" }), { target: { value: other } });
  const conversation = screen.getByRole("button", { name: "Agent 会话" });
  await waitFor(() => expect(conversation).toBeEnabled()); fireEvent.click(conversation);
  expect(await screen.findByPlaceholderText("描述要交给 Agent 的任务...")).toHaveValue("");
});
