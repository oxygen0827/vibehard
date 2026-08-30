import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import type { AgentEvent, TaskStart } from "@/lib/agent/protocol";

type Emit = (event: AgentEvent, codexThreadId?: string) => void;

export class CodexSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private sequence = 0;
  private threadId: string | undefined;
  private pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout }>();
  private approvals = new Map<string, { requestId: string | number; method: string }>();
  private terminalEmitted = false;

  constructor(private readonly emit: Emit) {}

  private send(message: Record<string, unknown>) {
    if (!this.process) throw new Error("Codex app-server is not running");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private request(method: string, params: Record<string, unknown>) {
    const id = randomUUID();
    const timeoutMs = Number(process.env.CODEX_REQUEST_TIMEOUT_MS ?? 30_000);
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ method, params, id });
    });
  }

  private event(type: AgentEvent["type"], data: Record<string, unknown>) {
    if (this.terminalEmitted && ["task.completed", "task.failed", "task.interrupted"].includes(type)) return;
    if (["task.completed", "task.failed", "task.interrupted"].includes(type)) this.terminalEmitted = true;
    this.emit({ eventId: randomUUID(), sequence: this.sequence++, timestamp: new Date().toISOString(), type, data }, this.threadId);
  }

  fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.event("task.failed", { message });
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private handleMessage(message: { id?: string | number; result?: Record<string, unknown>; error?: unknown; method?: string; params?: Record<string, unknown> }) {
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(String(message.id));
      if (pending) {
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`Codex request failed: ${JSON.stringify(message.error)}`));
        else pending.resolve(message.result);
      }
      this.pending.delete(String(message.id));
      return;
    }
    const params = message.params ?? {};
    const method = message.method ?? "";
    if (message.id !== undefined && (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval")) {
      const approvalId = randomUUID();
      this.approvals.set(approvalId, { requestId: message.id, method });
      this.event("approval.requested", { approvalId, tool: method, risk: method.includes("fileChange") ? "write" : "command", description: params.reason ?? params.command ?? "Agent 请求执行受限操作" });
    } else if (method === "item/agentMessage/delta") this.event("agent.message.delta", { text: params.delta ?? params.text ?? "" });
    else if (method === "item/started") this.event("tool.started", params);
    else if (method === "item/completed") this.event("tool.completed", params);
    else if (method === "turn/completed") {
      const status = (params.turn as { status?: string } | undefined)?.status;
      this.event(status === "interrupted" ? "task.interrupted" : status === "failed" ? "task.failed" : "task.completed", params);
    }
  }

  async start(task: TaskStart) {
    const args = process.env.CODEX_APP_SERVER_ARGS ? JSON.parse(process.env.CODEX_APP_SERVER_ARGS) as string[] : ["app-server", "--listen", "stdio://"];
    try {
      this.process = spawn(process.env.CODEX_BIN ?? "codex", args, { cwd: task.workspaceKey, env: process.env });
      createInterface({ input: this.process.stdout }).on("line", (line) => { try { this.handleMessage(JSON.parse(line)); } catch (error) { console.error("codex protocol parse error", error); } });
      this.process.stderr.on("data", (chunk) => this.event("command.output", { stream: "stderr", text: chunk.toString() }));
      this.process.on("error", (error) => {
        this.rejectPending(error);
        this.fail(error);
      });
      this.process.on("exit", (code, signal) => {
        const error = new Error(`Codex app-server exited (code=${String(code)}, signal=${String(signal)})`);
        this.rejectPending(error);
        if (!this.terminalEmitted) this.fail(error);
        this.process = null;
      });
      await this.request("initialize", { clientInfo: { name: "vibehard_runner", title: "VibeHard Runner", version: "0.1.0" } });
      this.send({ method: "initialized", params: {} });
      if (task.codexThreadId) {
        this.threadId = task.codexThreadId;
        await this.request("thread/resume", { threadId: this.threadId });
      } else {
        const result = await this.request("thread/start", { model: task.model, modelProvider: task.modelProvider, cwd: task.workspaceKey, sandbox: "read-only", approvalPolicy: "on-request" }) as { thread?: { id?: string } } | undefined;
        this.threadId = result?.thread?.id;
      }
      if (!this.threadId) throw new Error("Codex did not return a thread id");
      this.event("task.started", { input: task.input, model: task.model });
      await this.request("turn/start", { threadId: this.threadId, input: [{ type: "text", text: task.input }], cwd: task.workspaceKey, model: task.model, approvalPolicy: "on-request", sandboxPolicy: { type: "readOnly", networkAccess: false } });
    } catch (error) {
      this.fail(error);
      this.dispose();
      throw error;
    }
  }

  interrupt() { if (this.threadId) void this.request("turn/interrupt", { threadId: this.threadId }); }

  dispose() {
    this.rejectPending(new Error("Codex session disposed"));
    this.process?.kill();
    this.process = null;
  }

  resolveApproval(approvalId: string, decision: "approve" | "reject") {
    const approval = this.approvals.get(approvalId);
    if (!approval) return;
    this.send({ id: approval.requestId, result: { decision: decision === "approve" ? "accept" : "decline" } });
    this.approvals.delete(approvalId);
  }
}
