import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexSession, codexEnvironment, redactSensitiveText } from "./codex-stdio";
import { envelope, type AgentEvent, type TaskStart } from "@/lib/agent/protocol";

describe("CodexSession", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("applies managed provider settings via stdin and redacts runtime credentials from events", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE"); vi.stubEnv("FAKE_CODEX_MODE", "managed");
    const events: AgentEvent[] = [];
    const session = new CodexSession((event) => events.push(event), path.dirname(process.cwd()));
    try {
      await session.start({ ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "test", model: "managed", modelProvider: "vibehard" }, { baseUrl: "https://example.com/v1", apiKey: "managed-test-secret", model: "managed", protocol: "responses", revision: "test" });
      await vi.waitFor(() => expect(events.some((event) => event.type === "task.completed")).toBe(true));
      expect(JSON.stringify(events)).not.toContain("managed-test-secret");
      expect(JSON.stringify(events)).toContain("[REDACTED]");
    } finally { session.dispose(); }
  });
  it("ends silent provider requests rather than leaving a turn running indefinitely", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath); vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE"); vi.stubEnv("FAKE_CODEX_MODE", "interrupt"); vi.stubEnv("CODEX_IDLE_TIMEOUT_MS", "300");
    const events: AgentEvent[] = []; const session = new CodexSession((event) => events.push(event), path.dirname(process.cwd()));
    try {
      await session.start({ ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "test", model: "test" });
      await vi.waitFor(() => expect(events.filter((event) => event.type === "task.failed")).toHaveLength(1));
    } finally { session.dispose(); }
  });
  it("completes initialize, thread/start and turn/start over stdio", async () => { vi.stubEnv("CODEX_BIN", process.execPath); vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")])); const events: AgentEvent[] = []; const session = new CodexSession((event) => events.push(event), path.dirname(process.cwd())); const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Summarize this repo", model: "fake-model" }; await session.start(task); await new Promise((resolve) => setTimeout(resolve, 100)); expect(events.some((event) => event.type === "task.started")).toBe(true); expect(events.some((event) => event.type === "agent.message.delta" && event.data.text === "fake response")).toBe(true); expect(events.some((event) => event.type === "task.completed")).toBe(true); session.dispose(); });

  it("emits one failed terminal event when app-server exits during startup", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex-exit.mjs")]));
    const events: AgentEvent[] = [];
    const session = new CodexSession((event) => events.push(event), path.dirname(process.cwd()));
    const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Fail", model: "fake-model" };
    await expect(session.start(task)).rejects.toThrow(/exited/);
    expect(events.filter((event) => event.type === "task.failed")).toHaveLength(1);
  });

  it("forwards approval decisions and maps interrupted completion", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE");
    vi.stubEnv("FAKE_CODEX_MODE", "approval");
    const approvalEvents: AgentEvent[] = [];
    const approvalSession = new CodexSession((event) => approvalEvents.push(event), path.dirname(process.cwd()));
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
    const interruptSession = new CodexSession((event) => interruptEvents.push(event), path.dirname(process.cwd()));
    await interruptSession.start({ ...task, taskId: crypto.randomUUID(), input: "Interrupt" });
    await interruptSession.interrupt();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(interruptEvents.some((event) => event.type === "task.interrupted")).toBe(true);
    interruptSession.dispose();
  });

  it("maps command, reasoning, diff, complete message and artifact events", async () => {
    vi.stubEnv("CODEX_BIN", process.execPath);
    vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE");
    vi.stubEnv("FAKE_CODEX_MODE", "events");
    const events: AgentEvent[] = [];
    const session = new CodexSession((event) => events.push(event), path.dirname(process.cwd()));
    const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: process.cwd(), input: "Map events", model: "fake-model" };
    await session.start(task);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "command.output", data: expect.objectContaining({ text: "command output" }) }),
      expect.objectContaining({ type: "reasoning", data: expect.objectContaining({ text: "reasoning summary" }) }),
      expect.objectContaining({ type: "file.changed", data: expect.objectContaining({ diff: expect.stringContaining("diff --git") }) }),
      expect.objectContaining({ type: "agent.message", data: expect.objectContaining({ itemId: "message_1", text: "complete response" }) }),
      expect.objectContaining({ type: "artifact.created", data: expect.objectContaining({ name: "report.md", path: "report.md" }) }),
    ]));
    session.dispose();
  });

  it("passes only allowlisted environment variables and redacts secrets", () => {
    const environment = codexEnvironment({
      NODE_ENV: "test",
      PATH: "/usr/bin",
      DATABASE_URL: "postgres://secret-database",
      RUNNER_SHARED_SECRET: "runner-secret-value",
      MODEL_API_KEY: "provider-secret-value",
      UNRELATED_VALUE: "must-not-leak",
      CODEX_PROVIDER_ENV_ALLOWLIST: "MODEL_API_KEY",
    });
    expect(environment).toEqual({ NODE_ENV: "test", PATH: "/usr/bin", MODEL_API_KEY: "provider-secret-value" });
    expect(redactSensitiveText("Authorization: Bearer abc123 MODEL=provider-secret-value", { MODEL_API_KEY: "provider-secret-value" })).toBe("Authorization: [REDACTED] MODEL=[REDACTED]");
  });
});
