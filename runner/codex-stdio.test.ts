import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexSession } from "./codex-stdio";
import { envelope, type AgentEvent, type TaskStart } from "@/lib/agent/protocol";

describe("CodexSession", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("completes initialize, thread/start and turn/start over stdio", async () => { vi.stubEnv("CODEX_BIN", process.execPath); vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")])); const events: AgentEvent[] = []; const session = new CodexSession((event) => events.push(event)); const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Summarize this repo", model: "fake-model" }; await session.start(task); await new Promise((resolve) => setTimeout(resolve, 100)); expect(events.some((event) => event.type === "task.started")).toBe(true); expect(events.some((event) => event.type === "agent.message.delta" && event.data.text === "fake response")).toBe(true); expect(events.some((event) => event.type === "task.completed")).toBe(true); session.dispose(); });

  it("emits one failed terminal event when app-server exits during startup", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex-exit.mjs")]));
    const events: AgentEvent[] = [];
    const session = new CodexSession((event) => events.push(event));
    const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Fail", model: "fake-model" };
    await expect(session.start(task)).rejects.toThrow(/exited/);
    expect(events.filter((event) => event.type === "task.failed")).toHaveLength(1);
  });

  it("forwards approval decisions and maps interrupted completion", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("FAKE_CODEX_MODE", "approval");
    const approvalEvents: AgentEvent[] = [];
    const approvalSession = new CodexSession((event) => approvalEvents.push(event));
    const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Approve", model: "fake-model" };
    await approvalSession.start(task);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const approval = approvalEvents.find((event) => event.type === "approval.requested");
    expect(approval?.data.approvalId).toEqual(expect.any(String));
    approvalSession.resolveApproval(String(approval?.data.approvalId), "approve");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(approvalEvents.some((event) => event.type === "task.completed")).toBe(true);
    approvalSession.dispose();

    vi.stubEnv("FAKE_CODEX_MODE", "interrupt");
    const interruptEvents: AgentEvent[] = [];
    const interruptSession = new CodexSession((event) => interruptEvents.push(event));
    await interruptSession.start({ ...task, taskId: crypto.randomUUID(), input: "Interrupt" });
    interruptSession.interrupt();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(interruptEvents.some((event) => event.type === "task.interrupted")).toBe(true);
    interruptSession.dispose();
  });
});
