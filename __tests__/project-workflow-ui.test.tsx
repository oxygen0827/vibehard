import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AgentWorkbench } from "@/components/app/agent-workbench";
import { projectWorkflows } from "@/lib/agent/project-workflow";
import { deviceTaskExamples } from "@/components/app/device-workspace";

const id = "00000000-0000-4000-8000-000000000001", other = "00000000-0000-4000-8000-000000000002", thread = "00000000-0000-4000-8000-000000000003";
function setup(options: { existingThread?: boolean; failTurn?: boolean; failCreate?: boolean; recordedEvents?: unknown[]; recordedApprovals?: unknown[] } = {}) {
  vi.stubGlobal("EventSource", class { addEventListener() {} close() {} });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/api/projects")) return Response.json({ projects: [id, other].map((id, index) => ({ id, name: `项目${index + 1}`, runnerKey: "cloud-runner", defaultModel: "test" })) });
    if (url.endsWith("/api/models")) return Response.json({ models: [{ id: "model", providerId: "test", model: "test", displayName: "Test" }] });
    if (url.endsWith("/api/runners")) return Response.json({ runners: [{ runnerKey: "cloud-runner", name: "云端节点", status: "online", capabilities: [] }] });
    if (url.endsWith("/threads")) {
      if (init?.method === "POST" && options.failCreate) return Response.json({ error: "会话创建失败，请重试" }, { status: 503 });
      return Response.json(init?.method === "POST" ? { thread: { id: thread, title: "真实会话" } } : { threads: options.existingThread ? [{ id: thread, title: "真实会话" }] : [] });
    }
    if (url.endsWith("/artifacts")) return Response.json({ artifacts: [] });
    if (url.endsWith("/documents")) return Response.json({ documents: [] });
    if (url.includes("/api/design?")) return Response.json({ jobs: [] });
    if (url.endsWith(`/api/threads/${thread}`)) return Response.json({ events: options.recordedEvents ?? [], approvals: options.recordedApprovals ?? [], artifacts: [] });
    if (url.endsWith("/turns")) return options.failTurn ? Response.json({ error: "执行器暂时不可用，请稍后重试" }, { status: 503 }) : Response.json({ turn: { id: "turn" } });
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
  expect(screen.getByPlaceholderText("描述要交给 Agent 的任务...")).toHaveValue(deviceTaskExamples[mode]);
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
it.each(["debug", "embedded"] as const)("%s presents a simple module workspace instead of the three-column project workbench", async mode => {
  const fetcher = setup(); render(<AgentWorkbench mode={mode} />);
  await screen.findByRole("region", { name: "执行日志与结果" });
  expect(screen.getByRole("region", { name: "任务需求" })).toBeInTheDocument();
  expect(screen.getByText(/尚未打开会话/)).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "浏览器 USB 设备" })).toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "项目列表" })).not.toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "审批与产物" })).not.toBeInTheDocument();
  expect(screen.getByText("会话与高级设置").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText("项目资料与历史结果").closest("details")).not.toHaveAttribute("open");
  expect(fetcher.mock.calls.filter(([url, init]) => url.endsWith("/threads") && init?.method === "POST")).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(0);
});
it.each(["debug", "embedded"] as const)("%s explicitly sends once, creates a real project conversation and reuses it for follow-up", async mode => {
  window.history.replaceState(null, "", `/?project=${other}`);
  const fetcher = setup(); render(<AgentWorkbench mode={mode} />);
  await screen.findByRole("combobox", { name: "当前工作项目" });
  const input = screen.getByPlaceholderText("描述要交给 Agent 的任务...");
  fireEvent.change(input, { target: { value: "分析我的串口超时日志，不写设备" } });
  const send = screen.getByRole("button", { name: "发送任务" });
  await waitFor(() => expect(send).toBeEnabled()); fireEvent.click(send);
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(1));
  const creation = fetcher.mock.calls.filter(([url, init]) => url.endsWith("/threads") && init?.method === "POST");
  expect(creation).toHaveLength(1); expect(creation[0][0]).toContain(`/projects/${other}/threads`);
  const request = fetcher.mock.calls.find(([url]) => url.endsWith("/turns"))!;
  expect(request[0]).toContain(`/threads/${thread}/turns`);
  expect(JSON.parse(String(request[1]?.body)).input).toContain("分析我的串口超时日志，不写设备");
  expect(JSON.parse(String(request[1]?.body)).input).toContain(projectWorkflows[mode].prompt);
  await waitFor(() => expect(input).toHaveValue(""));
  fireEvent.change(input, { target: { value: "补充日志：read timeout" } }); fireEvent.click(send);
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(2));
  expect(fetcher.mock.calls.filter(([url, init]) => url.endsWith("/threads") && init?.method === "POST")).toHaveLength(1);
});
it("preserves the user's task and shows a server failure without retrying a model request", async () => {
  const fetcher = setup({ existingThread: true, failTurn: true }); render(<AgentWorkbench mode="debug" />);
  await screen.findByRole("combobox", { name: "当前工作项目" });
  const input = screen.getByPlaceholderText("描述要交给 Agent 的任务...");
  fireEvent.change(input, { target: { value: "定位 I2C 超时" } });
  const send = screen.getByRole("button", { name: "发送任务" });
  await waitFor(() => expect(send).toBeEnabled()); fireEvent.click(send);
  expect(await screen.findByRole("alert")).toHaveTextContent("执行器暂时不可用");
  expect(input).toHaveValue("定位 I2C 超时");
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url, init]) => url.endsWith("/threads") && init?.method === "POST")).toHaveLength(0);
});
it("does not submit a task when conversation creation fails", async () => {
  const fetcher = setup({ failCreate: true }); render(<AgentWorkbench mode="embedded" />);
  await screen.findByRole("combobox", { name: "当前工作项目" });
  fireEvent.change(screen.getByPlaceholderText("描述要交给 Agent 的任务..."), { target: { value: "设计最小验证程序" } });
  const send = screen.getByRole("button", { name: "发送任务" }); await waitFor(() => expect(send).toBeEnabled()); fireEvent.click(send);
  expect(await screen.findByRole("alert")).toHaveTextContent("会话创建失败");
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(0);
});
it("shows recorded output and pending approvals outside the collapsed advanced controls", async () => {
  const fetcher = setup({ existingThread: true, recordedEvents: [{ eventId: "output", sequence: 0, type: "command.output", timestamp: "2026-10-01T00:00:00Z", data: { text: "真实工具返回：read timeout" } }], recordedApprovals: [{ id: "approval", tool: "shell", risk: "command", status: "pending", description: "执行测试命令", details: { command: "make test" } }] });
  render(<AgentWorkbench mode="debug" />);
  const prepare = await screen.findByRole("button", { name: "准备外设调试清单" }); await waitFor(() => expect(prepare).toBeEnabled()); fireEvent.click(prepare);
  expect(await screen.findByText("真实工具返回：read timeout")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "待确认操作" }).closest("details")).toBeNull();
  expect(screen.getByRole("button", { name: "允许" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/turns"))).toHaveLength(0);
});
