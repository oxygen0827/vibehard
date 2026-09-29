import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/server/store", () => ({ authenticateRunner: vi.fn() }));
vi.mock("@/lib/server/design-artifacts", () => ({ pendingRunnerDesigns: vi.fn(), acknowledgeRunnerDesign: vi.fn() }));
import { authenticateRunner } from "@/lib/server/store";
import { pendingRunnerDesigns, acknowledgeRunnerDesign } from "@/lib/server/design-artifacts";
import { GET, POST } from "@/app/api/runners/design-artifacts/route";
beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateRunner).mockResolvedValue(true); vi.mocked(pendingRunnerDesigns).mockResolvedValue({ items: [], next: null, failed: [] }); });
const request = (runner = "cloud-runner", body?: unknown, query = "") => new NextRequest(`https://example.invalid/api/runners/design-artifacts${query}`, {
  method: body ? "POST" : "GET", headers: { "X-Runner-Key": runner, Authorization: "Bearer test-secret" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
it("rejects unauthenticated and device runners before reading source documents", async () => {
  expect((await GET(request("device-runner"))).status).toBe(403);
  vi.mocked(authenticateRunner).mockResolvedValue(false);
  expect((await GET(request())).status).toBe(403);
  expect(pendingRunnerDesigns).not.toHaveBeenCalled();
});
it("validates pagination and restricts receipts to server checked designs", async () => {
  expect((await GET(request("cloud-runner", undefined, "?after=../../secret"))).status).toBe(400);
  const response = await GET(request()); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  vi.mocked(acknowledgeRunnerDesign).mockResolvedValue(false);
  expect((await POST(request("cloud-runner", { designId: crypto.randomUUID(), sha256: "a".repeat(64) }))).status).toBe(404);
  expect((await POST(request("device-runner", { designId: crypto.randomUUID(), sha256: "a".repeat(64) }))).status).toBe(403);
});
