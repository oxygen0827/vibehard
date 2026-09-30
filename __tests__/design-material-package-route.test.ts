// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { strFromU8, unzipSync } from "fflate";
import type { DesignJob } from "@/lib/agent/design-jobs";
vi.mock("@/lib/server/http", async original => ({ ...await original<typeof import("@/lib/server/http")>(), requestUser: vi.fn() }));
vi.mock("@/lib/server/design-job-store", () => ({ getDesign: vi.fn() }));
import { requestUser } from "@/lib/server/http";
import { getDesign } from "@/lib/server/design-job-store";
import { GET } from "@/app/api/design/[id]/materials/route";
const owner = { id: crypto.randomUUID(), name: "Owner", email: "owner@example.invalid", role: "user" as const };
const id = crypto.randomUUID();
const req = () => new NextRequest("https://example.invalid/api/design/materials");
const ctx = (value = id) => ({ params: Promise.resolve({ id: value }) });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(requestUser).mockResolvedValue(owner); });
it("rejects anonymous and invalid IDs before database access; passes only the authenticated owner", async () => {
  vi.mocked(requestUser).mockResolvedValue(null); expect((await GET(req(), ctx())).status).toBe(401);
  expect(getDesign).not.toHaveBeenCalled();
  vi.mocked(requestUser).mockResolvedValue(owner); expect((await GET(req(), ctx("../../secret"))).status).toBe(400);
  expect(getDesign).not.toHaveBeenCalled();
  vi.mocked(getDesign).mockResolvedValue(null); expect((await GET(req(), ctx())).status).toBe(404);
  expect(getDesign).toHaveBeenCalledExactlyOnceWith(owner.id, id);
});
it("fails closed on unfinished jobs or storage errors without leaking details", async () => {
  vi.mocked(getDesign).mockResolvedValue({ status: "running", result: null } as DesignJob);
  expect((await GET(req(), ctx())).status).toBe(409);
  vi.mocked(getDesign).mockRejectedValue(new Error("secret database connection"));
  const response = await GET(req(), ctx()); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});
it("returns a private download bound to the saved project and job", async () => {
  const projectId = crypto.randomUUID();
  vi.mocked(getDesign).mockResolvedValue({ id, projectId, projectName: "Owner project", requirement: "saved requirement", status: "completed", model: "fixture",
    knowledgeVersion: null, completedAt: "2026-09-30T00:00:00Z", result: { architecture: ["draft"], bom: [{ item: "sensor", model: "SHT40", qty: 1, estCost: "¥10（估算）" }], interfaces: ["I2C"], risks: [{ level: "低", desc: "unverified" }] } } as DesignJob);
  const response = await GET(req(), ctx()); expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain(`project-materials-${id}.zip`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  expect(JSON.parse(strFromU8(files["manifest.json"]))).toMatchObject({ projectId, designId: id });
});
