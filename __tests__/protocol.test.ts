import { describe, expect, it } from "vitest";
import { assertProtocolVersion, envelope, RUNNER_PROTOCOL_VERSION } from "@/lib/agent/protocol";

describe("runner protocol", () => {
  it("generates versioned idempotent envelopes", () => { const first = envelope(); const second = envelope(); expect(first.protocolVersion).toBe(RUNNER_PROTOCOL_VERSION); expect(first.messageId).not.toBe(second.messageId); });
  it("rejects unsupported protocol versions", () => { expect(() => assertProtocolVersion(99)).toThrow(/Unsupported runner protocol/); });
});
