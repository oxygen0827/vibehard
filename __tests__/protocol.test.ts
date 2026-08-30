import { describe, expect, it } from "vitest";
import { assertProtocolVersion, envelope, parseGatewayToRunnerMessage, parseRunnerToPlatformMessage, RUNNER_PROTOCOL_VERSION } from "@/lib/agent/protocol";

describe("runner protocol", () => {
  it("generates versioned idempotent envelopes", () => { const first = envelope(); const second = envelope(); expect(first.protocolVersion).toBe(RUNNER_PROTOCOL_VERSION); expect(first.messageId).not.toBe(second.messageId); });
  it("rejects unsupported protocol versions", () => { expect(() => assertProtocolVersion(99)).toThrow(/Unsupported runner protocol/); });
  it("validates runner messages before the gateway processes them", () => {
    const hello = { ...envelope(), type: "runner.hello", runnerKey: "runner-1", instanceId: crypto.randomUUID(), secret: "a".repeat(32), capabilities: ["codex"] };
    expect(parseRunnerToPlatformMessage(hello)).toMatchObject({ type: "runner.hello", runnerKey: "runner-1" });
    expect(() => parseRunnerToPlatformMessage({ ...hello, secret: "short" })).toThrow();
    expect(() => parseRunnerToPlatformMessage({ ...hello, protocolVersion: 2 })).toThrow();
  });
  it("requires task, thread and approval ids on approval commands", () => {
    const approval = { ...envelope(), type: "approval.resolve", taskId: crypto.randomUUID(), threadId: crypto.randomUUID(), approvalId: crypto.randomUUID(), decision: "approve" };
    expect(parseGatewayToRunnerMessage(approval)).toMatchObject({ type: "approval.resolve", decision: "approve" });
    expect(() => parseGatewayToRunnerMessage({ ...approval, threadId: "invalid" })).toThrow();
  });
});
