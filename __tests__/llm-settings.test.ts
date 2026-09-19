// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { candidateLlm, decryptKey, encryptKey, publicLlm, runtimeLlm, saveLlm } from "@/lib/server/llm-settings";
import { isPublicAddress, upstreamError } from "@/lib/server/llm-client";
import { listModels } from "@/lib/server/store";
import { llmInput, type LlmInput } from "@/lib/agent/llm";

const input: LlmInput = { purpose: "agent", model: "test-model", baseUrl: "https://example.com/v1", protocol: "responses", apiKey: "test-secret-123456", revision: null };
beforeEach(() => globalThis.__vibehardLlmSettings?.clear());
describe("managed LLM credentials", () => {
  it("encrypts with authenticated purpose binding and rejects tampering", () => {
    const value = encryptKey(input.apiKey!, "agent");
    expect(value).not.toContain(input.apiKey);
    expect(decryptKey(value, "agent")).toBe(input.apiKey);
    expect(() => decryptKey(value, "design")).toThrow();
    expect(encryptKey(input.apiKey!, "agent")).not.toBe(value);
  });
  it("never returns keys to admin readers or the model list and hot-loads a replacement", async () => {
    const saved = await saveLlm(input, "admin");
    expect(saved.hasApiKey).toBe(true);
    expect(JSON.stringify(await publicLlm("agent"))).not.toContain("test-secret");
    expect(await listModels()).toEqual([expect.objectContaining({ model: "test-model", providerId: "vibehard" })]);
    await saveLlm({ ...input, revision: saved.revision, apiKey: "replacement-key-123", model: "new-model" }, "admin");
    expect(await runtimeLlm("agent")).toMatchObject({ model: "new-model", apiKey: "replacement-key-123" });
    expect(JSON.stringify(await listModels())).not.toContain("replacement-key");
  });
  it("retains blank keys only at the same endpoint and rejects stale updates", async () => {
    const saved = await saveLlm(input, "admin");
    expect((await candidateLlm({ ...input, revision: saved.revision, apiKey: "" })).apiKey).toBe(input.apiKey);
    await expect(candidateLlm({ ...input, revision: saved.revision, baseUrl: "https://other.example/v1", apiKey: "" })).rejects.toThrow("重新输入");
    await expect(saveLlm(input, "admin")).rejects.toThrow("刷新");
  });
  it("rejects unsupported protocols, malformed base URLs and private addresses", async () => {
    expect(llmInput.safeParse({ ...input, protocol: "chat-completions" }).success).toBe(false);
    await expect(candidateLlm({ ...input, baseUrl: "http://example.com/v1" })).rejects.toThrow("HTTPS");
    await expect(candidateLlm({ ...input, baseUrl: "https://example.com/v1/responses" })).rejects.toThrow("根地址");
    for (const address of ["127.0.0.1", "169.254.169.254", "10.0.0.1", "172.16.0.1", "192.168.0.1", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1"]) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
  });
  it("reports quotas and authentication errors without echoing provider bodies", () => {
    expect(upstreamError(429, "insufficient_quota secret").message).toContain("额度不足");
    expect(upstreamError(401, "secret").message).toContain("认证");
    expect(upstreamError(500, "secret").message).not.toContain("secret");
  });
});
