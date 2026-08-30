import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { WebSocket } from "ws";
import { assertProtocolVersion, envelope, type AgentEvent, type GatewayToRunnerMessage, type RunnerEvent } from "@/lib/agent/protocol";
import { CodexSession } from "./codex-stdio";

const runnerKey = process.env.RUNNER_ID ?? "local-runner";
let gatewayUrl = process.env.RUNNER_GATEWAY_URL ?? "ws://127.0.0.1:8787/runner";
let secret = process.env.RUNNER_SHARED_SECRET ?? "";
let codexVersion: string | undefined;
const workspaceRoot = path.resolve(process.env.RUNNER_WORKSPACE_ROOT ?? "/tmp/vibehard-workspaces");
const sessions = new Map<string, CodexSession>();
const seenCommands = new Set<string>();
const outbound: RunnerEvent[] = [];
let activeSocket: WebSocket | null = null;
let accepted = false;

async function workspaceFor(key: string) {
  const workspace = path.resolve(workspaceRoot, key);
  if (workspace !== workspaceRoot && !workspace.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error("Workspace key escapes runner root");
  await mkdir(workspace, { recursive: true });
  return workspace;
}

function connect() {
  const socket = new WebSocket(gatewayUrl);
  activeSocket = socket;
  accepted = false;
  let heartbeat: NodeJS.Timeout | undefined;
  socket.on("open", () => { socket.send(JSON.stringify({ ...envelope(), type: "runner.hello", runnerKey, capabilities: ["codex", "workspace-read", "workspace-write-approval"], codexVersion, secret })); heartbeat = setInterval(() => socket.send(JSON.stringify({ ...envelope(), type: "heartbeat", runnerKey })), 15_000); });
  socket.on("message", (raw) => {
    void (async () => {
      try {
        const message = JSON.parse(raw.toString()) as GatewayToRunnerMessage;
        assertProtocolVersion(message.protocolVersion);
        if (message.type === "runner.accepted") {
          if (message.runnerKey !== runnerKey) throw new Error("Gateway accepted a different runner identity");
          accepted = true;
          while (outbound.length > 0 && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(outbound.shift()));
          return;
        }
        const commandId = message.messageId;
        if (seenCommands.has(commandId)) { socket.send(JSON.stringify({ ...envelope(), type: "command.ack", runnerKey, commandId })); return; }
        if (message.type === "task.start") {
          const workspace = await workspaceFor(message.workspaceKey);
          const task = { ...message, workspaceKey: workspace };
          const session = new CodexSession((event: AgentEvent, codexThreadId) => {
            const outgoing: RunnerEvent = { ...envelope(), type: "event", runnerKey, taskId: message.taskId, threadId: message.threadId, codexThreadId, event };
            if (activeSocket?.readyState === WebSocket.OPEN && accepted) activeSocket.send(JSON.stringify(outgoing));
            else outbound.push(outgoing);
            if (["task.completed", "task.failed", "task.interrupted"].includes(event.type)) {
              sessions.delete(message.taskId);
              queueMicrotask(() => session.dispose());
            }
          });
          sessions.set(message.taskId, session);
          try { await session.start(task); }
          catch (error) { session.fail(error); }
        } else if (message.type === "task.interrupt") sessions.get(message.taskId)?.interrupt();
        else if (message.type === "approval.resolve") sessions.get(message.taskId)?.resolveApproval(message.approvalId, message.decision);
        seenCommands.add(commandId);
        if (seenCommands.size > 10_000) seenCommands.delete(seenCommands.values().next().value!);
        socket.send(JSON.stringify({ ...envelope(), type: "command.ack", runnerKey, commandId }));
      } catch (error) { console.error("runner message error", error); }
    })();
  });
  socket.on("close", () => { if (heartbeat) clearInterval(heartbeat); if (activeSocket === socket) { activeSocket = null; accepted = false; } setTimeout(connect, 2_000); });
  socket.on("error", () => socket.close());
}

async function bootstrap() {
  await mkdir(workspaceRoot, { recursive: true });
  try {
    const result = await promisify(execFile)(process.env.CODEX_BIN ?? "codex", ["--version"], { timeout: 5_000 });
    codexVersion = result.stdout.trim();
  } catch {
    codexVersion = undefined;
  }
  if (!secret) {
    const platformUrl = process.env.RUNNER_PLATFORM_URL ?? "http://127.0.0.1:3000";
    const registrationToken = process.env.RUNNER_REGISTRATION_TOKEN;
    if (!registrationToken) throw new Error("RUNNER_SHARED_SECRET 或 RUNNER_REGISTRATION_TOKEN 必须配置一个");
    const response = await fetch(`${platformUrl}/api/runners/register`, { method: "POST", headers: { Authorization: `Bearer ${registrationToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ runnerKey, name: process.env.RUNNER_NAME ?? "VibeHard Codex Runner", capabilities: ["codex", "workspace-read", "workspace-write-approval"] }) });
    if (!response.ok) throw new Error(`Runner registration failed: ${response.status}`);
    const registered = await response.json() as { secret: string; gatewayUrl?: string };
    secret = registered.secret;
    gatewayUrl = registered.gatewayUrl ?? gatewayUrl;
  }
  connect();
}

void bootstrap().catch((error) => { console.error(error); process.exitCode = 1; });
