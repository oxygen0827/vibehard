import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  assertProtocolVersion,
  envelope,
  type RunnerToPlatformMessage,
} from "@/lib/agent/protocol";

export interface GatewayCommand {
  id: string;
  payload: Record<string, unknown>;
}

export interface GatewayStore {
  authenticateRunner(runnerKey: string, secret: string): Promise<boolean>;
  heartbeatRunner(runnerKey: string, secret: string, capabilities?: string[]): Promise<boolean>;
  getQueuedRunnerCommands(runnerKey: string): Promise<GatewayCommand[]>;
  markRunnerCommand(id: string, status: "sent" | "failed", runnerKey: string): Promise<void>;
  ingestRunnerEvent(message: Extract<RunnerToPlatformMessage, { type: "event" }>): Promise<void>;
}

export interface RunnerGateway {
  server: Server;
  wss: WebSocketServer;
  close(): Promise<void>;
}

export function createRunnerGateway(store: GatewayStore, pollIntervalMs = 500): RunnerGateway {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "vibehard-runner-gateway" }));
  });
  const wss = new WebSocketServer({ server, path: "/runner" });
  const connected = new Map<string, WebSocket>();
  const inflight = new Map<string, Set<string>>();

  wss.on("connection", (socket) => {
    let runnerKey: string | null = null;
    let runnerSecret: string | null = null;
    let messageQueue = Promise.resolve();

    socket.on("message", (raw) => {
      messageQueue = messageQueue.then(async () => {
        try {
          const message = JSON.parse(raw.toString()) as RunnerToPlatformMessage;
          assertProtocolVersion(message.protocolVersion);

          if (message.type === "runner.hello") {
            if (!message.secret || !(await store.authenticateRunner(message.runnerKey, message.secret))) {
              socket.close(1008, "invalid runner credentials");
              return;
            }
            runnerKey = message.runnerKey;
            runnerSecret = message.secret;
            await store.heartbeatRunner(runnerKey, runnerSecret, message.capabilities);
            connected.get(runnerKey)?.close(1000, "runner reconnected");
            connected.set(runnerKey, socket);
            inflight.set(runnerKey, new Set());
            socket.send(JSON.stringify({ ...envelope(), type: "runner.accepted", runnerKey }));
            return;
          }

          if (!runnerKey || !runnerSecret) {
            socket.close(1008, "runner hello required");
            return;
          }
          if ("runnerKey" in message && message.runnerKey !== runnerKey) {
            socket.close(1008, "runner identity mismatch");
            return;
          }
          if (message.type === "heartbeat") {
            if (!(await store.heartbeatRunner(runnerKey, runnerSecret))) socket.close(1008, "runner credentials revoked");
            return;
          }
          if (message.type === "command.ack") {
            await store.markRunnerCommand(message.commandId, "sent", runnerKey);
            inflight.get(runnerKey)?.delete(message.commandId);
            return;
          }
          if (message.type === "event") await store.ingestRunnerEvent(message);
        } catch (error) {
          console.error("runner gateway message error", error);
          socket.close(1003, "invalid runner message");
        }
      });
    });

    socket.on("close", () => {
      if (runnerKey && connected.get(runnerKey) === socket) {
        connected.delete(runnerKey);
        inflight.delete(runnerKey);
      }
    });
  });

  const poller = setInterval(() => {
    void (async () => {
      for (const [runnerKey, socket] of connected) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        for (const command of await store.getQueuedRunnerCommands(runnerKey)) {
          if (inflight.get(runnerKey)?.has(command.id)) continue;
          try {
            inflight.get(runnerKey)?.add(command.id);
            socket.send(JSON.stringify({ ...command.payload, messageId: command.id }));
          } catch {
            inflight.get(runnerKey)?.delete(command.id);
            await store.markRunnerCommand(command.id, "failed", runnerKey);
          }
        }
      }
    })().catch((error) => console.error("runner gateway poll error", error));
  }, pollIntervalMs);
  poller.unref();

  return {
    server,
    wss,
    close: async () => {
      clearInterval(poller);
      for (const socket of connected.values()) socket.close(1001, "gateway stopping");
      await new Promise<void>((resolve, reject) => wss.close((error) => error ? reject(error) : resolve()));
      if (server.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
