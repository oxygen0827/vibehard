import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { envelope, type AgentEvent, type RunnerEvent } from "@/lib/agent/protocol";
import { createRunnerGateway, type GatewayStore, type RunnerGateway } from "./server";

const gateways: RunnerGateway[] = [];
const VALID_SECRET = "valid-secret-with-at-least-32-bytes";
const INSTANCE_ID = "11111111-1111-4111-8111-111111111111";
const FIRST_EVENT_ID = "22222222-2222-4222-8222-222222222222";
const SECOND_EVENT_ID = "33333333-3333-4333-8333-333333333333";

afterEach(async () => {
  await Promise.all(gateways.splice(0).map((gateway) => gateway.close()));
});

function store(secret = VALID_SECRET): GatewayStore {
  return {
    authenticateRunner: vi.fn(async (_runnerKey, supplied) => supplied === secret),
    heartbeatRunner: vi.fn(async () => true),
    markRunnerOffline: vi.fn(async () => undefined),
    markStaleRunnersOffline: vi.fn(async () => undefined),
    getQueuedRunnerCommands: vi.fn(async () => []),
    markRunnerCommand: vi.fn(async () => undefined),
    ingestRunnerEvent: vi.fn(async () => undefined),
  };
}

async function listen(gateway: RunnerGateway) {
  gateways.push(gateway);
  await new Promise<void>((resolve) => gateway.server.listen(0, "127.0.0.1", resolve));
  const address = gateway.server.address();
  if (!address || typeof address === "string") throw new Error("Gateway did not bind a TCP port");
  return `ws://127.0.0.1:${address.port}/runner`;
}

describe("runner gateway", () => {
  it("rejects an invalid runner secret", async () => {
    const url = await listen(createRunnerGateway(store(), 10));
    const socket = new WebSocket(url);
    const close = new Promise<number>((resolve) => socket.on("close", resolve));
    socket.on("open", () => socket.send(JSON.stringify({
      ...envelope(),
      type: "runner.hello",
      runnerKey: "test-runner",
      instanceId: INSTANCE_ID,
      secret: "wrong-secret-with-at-least-32-bytes",
      capabilities: ["codex"],
    })));
    await expect(close).resolves.toBe(1008);
  });

  it("returns a complete versioned acceptance envelope", async () => {
    const gatewayStore = store();
    const url = await listen(createRunnerGateway(gatewayStore, 10));
    const socket = new WebSocket(url);
    const accepted = new Promise<Record<string, unknown>>((resolve) => socket.on("message", (raw) => resolve(JSON.parse(raw.toString()))));
    await new Promise<void>((resolve) => socket.on("open", resolve));
    socket.send(JSON.stringify({
      ...envelope(),
      type: "runner.hello",
      runnerKey: "test-runner",
      instanceId: INSTANCE_ID,
      secret: VALID_SECRET,
      capabilities: ["codex"],
    }));
    await expect(accepted).resolves.toMatchObject({
      type: "runner.accepted",
      protocolVersion: 1,
      runnerKey: "test-runner",
      messageId: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(gatewayStore.heartbeatRunner).toHaveBeenCalledWith("test-runner", VALID_SECRET, ["codex"], INSTANCE_ID);
    const closed = new Promise<void>((resolve) => socket.once("close", () => resolve()));
    socket.close();
    await closed;
    await vi.waitFor(() => expect(gatewayStore.markRunnerOffline).toHaveBeenCalledWith("test-runner"));
  });

  it("ingests messages from one runner connection in wire order", async () => {
    const order: string[] = [];
    let finish: (() => void) | undefined;
    const completed = new Promise<void>((resolve) => { finish = resolve; });
    const gatewayStore = store();
    gatewayStore.ingestRunnerEvent = vi.fn(async (message) => {
      if (message.event.eventId === FIRST_EVENT_ID) await new Promise((resolve) => setTimeout(resolve, 25));
      order.push(message.event.eventId);
      if (order.length === 2) finish?.();
    });
    const url = await listen(createRunnerGateway(gatewayStore, 10));
    const socket = new WebSocket(url);
    const acknowledgements: Record<string, unknown>[] = [];
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString()) as Record<string, unknown>;
      if (message.type === "event.ack") acknowledgements.push(message);
    });
    await new Promise<void>((resolve) => socket.on("open", resolve));
    socket.send(JSON.stringify({ ...envelope(), type: "runner.hello", runnerKey: "test-runner", instanceId: INSTANCE_ID, secret: VALID_SECRET, capabilities: ["codex"] }));
    await new Promise<void>((resolve) => socket.once("message", () => resolve()));

    const runnerEvent = (event: AgentEvent): RunnerEvent => ({ ...envelope(), type: "event", runnerKey: "test-runner", taskId: crypto.randomUUID(), event });
    socket.send(JSON.stringify(runnerEvent({ eventId: FIRST_EVENT_ID, sequence: 0, timestamp: new Date().toISOString(), type: "tool.started", data: {} })));
    socket.send(JSON.stringify(runnerEvent({ eventId: SECOND_EVENT_ID, sequence: 1, timestamp: new Date().toISOString(), type: "tool.completed", data: {} })));
    await completed;
    expect(order).toEqual([FIRST_EVENT_ID, SECOND_EVENT_ID]);
    await vi.waitFor(() => expect(acknowledgements).toHaveLength(2));
    expect(acknowledgements.map((message) => message.eventId)).toEqual([FIRST_EVENT_ID, SECOND_EVENT_ID]);
    socket.close();
  });

  it("rejects a second hello on an authenticated connection", async () => {
    const url = await listen(createRunnerGateway(store(), 10));
    const socket = new WebSocket(url);
    await new Promise<void>((resolve) => socket.on("open", resolve));
    const hello = { ...envelope(), type: "runner.hello", runnerKey: "test-runner", instanceId: INSTANCE_ID, secret: VALID_SECRET, capabilities: ["codex"] };
    socket.send(JSON.stringify(hello));
    await new Promise<void>((resolve) => socket.once("message", () => resolve()));
    const closed = new Promise<number>((resolve) => socket.once("close", resolve));
    socket.send(JSON.stringify({ ...hello, ...envelope() }));
    await expect(closed).resolves.toBe(1008);
  });
});
