// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requireDb } from "@/lib/db";
import { users, runnerNodes, projectDocuments } from "@/lib/db/schema";
import { createUser, registerRunner, createProject, createThread, createTurn, getQueuedRunnerCommands } from "@/lib/server/store";
import { createSessionToken } from "@/lib/server/security";
import { POST } from "@/app/api/projects/[id]/device-reports/route";
import { GET as list } from "@/app/api/projects/[id]/documents/route";
import { GET as download } from "@/app/api/projects/[id]/documents/[documentId]/route";
import { DEVICE_REPORT_CAPABILITY, PROJECT_FILES_CAPABILITY, PROJECT_DOCUMENT_LIMIT } from "@/lib/agent/project-document";
import { archiveDeviceReport, beginProjectDocument, projectFilesForTurn } from "@/lib/server/project-documents";
import { deviceReportSchema } from "@/lib/device/device-report";
import { sample } from "./fixtures/device-report";
import { CodexSession } from "@/runner/codex-stdio";
import type { AgentEvent, TaskStart } from "@/lib/agent/protocol";
vi.mock("@/lib/server/retrieval-client", () => ({ queryPrivateIndex: vi.fn().mockResolvedValue({ sources: [], revision: "a".repeat(64) }), privateIndexRevision: vi.fn().mockResolvedValue("a".repeat(64)) }));
const enabled = process.env.VIBEHARD_DEVICE_TEST_DATABASE === "1";
if (enabled) {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || !["/vibehard_device_acceptance_20261001", "/vibehard_documents_test"].includes(url.pathname)) throw new Error("Refusing non-isolated device report test database");
}
(enabled ? describe : describe.skip)("device archive and Agent handoff, actual PostgreSQL", () => {
  const ids: string[] = []; const runners: string[] = []; const roots: string[] = [];
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (ids.length) await requireDb().delete(users).where(inArray(users.id, ids.splice(0)));
    if (runners.length) await requireDb().delete(runnerNodes).where(inArray(runnerNodes.runnerKey, runners.splice(0)));
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });
  async function fixture(capabilities = [PROJECT_FILES_CAPABILITY, DEVICE_REPORT_CAPABILITY]) {
    const user = await createUser({ email: `device-${randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "test" }); ids.push(user.id);
    const runnerKey = `device-${randomUUID()}`; runners.push(runnerKey);
    await registerRunner({ runnerKey, name: "Isolated device test", capabilities });
    const project = await createProject(user.id, { name: "设备报告隔离项目", workspaceKey: randomUUID(), runnerKey, model: "fake" });
    return { user, project, runnerKey, cookie: `vibehard_session=${createSessionToken(user)}` };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const capture = () => ({ ...sample, id: randomUUID(), capturedAt: new Date().toISOString() });
  const request = (f: Fixture, report: unknown, projectId = f.project.id) => new NextRequest(`http://localhost/api/projects/${projectId}/device-reports`, { method: "POST", headers: { Cookie: f.cookie, "Content-Type": "application/json", Origin: "http://localhost" }, body: JSON.stringify(report) });
  const read = (f: Fixture, suffix = "") => new NextRequest(`http://localhost/api/documents${suffix}`, { headers: { Cookie: f.cookie } });
  it("archives, downloads, replays without duplication and actually reads the file in an Agent child process", async () => {
    const f = await fixture(); const report = capture(); const ctx = { params: Promise.resolve({ id: f.project.id }) };
    const response = await POST(request(f, report), ctx); expect(response.status).toBe(201);
    const { document } = await response.json();
    const repeated = await POST(request(f, report), ctx); expect(repeated.status).toBe(200); expect((await repeated.json()).document).toEqual(document);
    expect((await (await list(read(f), ctx)).json()).documents).toHaveLength(1);
    const md = await download(read(f), { params: Promise.resolve({ id: f.project.id, documentId: report.id }) });
    expect(md.status).toBe(200); const markdown = await md.text();
    expect(createHash("sha256").update(markdown).digest("hex")).toBe(document.sha256);
    const thread = (await createThread(f.user.id, f.project.id))!;
    await createTurn(f.user.id, thread.id, "读取设备报告", "fake");
    const task = (await getQueuedRunnerCommands(f.runnerKey))[0].payload as unknown as TaskStart;
    expect(task.projectFiles?.files[0]).toMatchObject({ kind: "device-report", sha256: document.sha256, markdown });
    const root = await realpath(await mkdtemp(path.join(tmpdir(), "device-child-"))); roots.push(root);
    vi.stubEnv("CODEX_BIN", process.execPath); vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE"); vi.stubEnv("FAKE_CODEX_MODE", "device-report");
    const events: AgentEvent[] = []; const session = new CodexSession(event => events.push(event), path.dirname(root));
    try {
      await session.start({ ...task, workspaceKey: root });
      await vi.waitFor(() => expect(events.some(event => event.type === "task.completed")).toBe(true));
      expect(events.some(event => event.type === "tool.completed" && JSON.stringify(event).includes("device-report-read"))).toBe(true);
    } finally { session.dispose(); }
  });
  it("denies anonymous and cross-account writes, lists, downloads and turns", async () => {
    const owner = await fixture(); const outsider = await fixture(); const report = capture();
    const ctx = { params: Promise.resolve({ id: owner.project.id }) };
    expect((await POST(new NextRequest(`http://localhost/api/projects/${owner.project.id}/device-reports`, { method: "POST" }), ctx)).status).toBe(401);
    expect((await POST(request(outsider, report, owner.project.id), ctx)).status).toBe(404);
    await archiveDeviceReport(owner.user.id, owner.project.id, report);
    expect((await list(read(outsider), ctx)).status).toBe(404);
    expect((await download(read(outsider), { params: Promise.resolve({ id: owner.project.id, documentId: report.id }) })).status).toBe(404);
    const thread = (await createThread(owner.user.id, owner.project.id))!;
    await expect(createTurn(outsider.user.id, thread.id, "读取", "fake")).resolves.toBeNull();
    expect((await getQueuedRunnerCommands(owner.runnerKey))).toHaveLength(0);
  });
  it("serializes repeated submissions and rejects mutated, cross-project and cross-kind IDs", async () => {
    const f = await fixture(); const other = await fixture(); const report = capture();
    const results = await Promise.all(Array.from({ length: 4 }, () => archiveDeviceReport(f.user.id, f.project.id, report)));
    expect(results.filter(result => result.created)).toHaveLength(1);
    expect(new Set(results.map(result => result.file.sha256)).size).toBe(1);
    await expect(archiveDeviceReport(f.user.id, f.project.id, { ...report, elapsedMs: report.elapsedMs + 1 })).rejects.toMatchObject({ status: 409 });
    await expect(archiveDeviceReport(other.user.id, other.project.id, report)).rejects.toMatchObject({ status: 409 });
    await expect(beginProjectDocument(f.user.id, f.project.id, { id: report.id, fileName: "x.pdf", sha256: createHash("sha256").update(JSON.stringify(deviceReportSchema.parse(report))).digest("hex"), mimeType: "application/pdf", byteSize: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await requireDb().select().from(projectDocuments).where(eq(projectDocuments.projectId, f.project.id)))).toHaveLength(1);
  });
  it("rejects old Runner capability before enqueue, and does not expose a fake OSS source", async () => {
    const f = await fixture([PROJECT_FILES_CAPABILITY]); const report = capture();
    await archiveDeviceReport(f.user.id, f.project.id, report);
    const thread = (await createThread(f.user.id, f.project.id))!;
    await expect(createTurn(f.user.id, thread.id, "读取", "fake")).rejects.toThrow("不支持资料同步");
    expect((await getQueuedRunnerCommands(f.runnerKey))).toHaveLength(0);
    expect((await download(read(f, "?format=source"), { params: Promise.resolve({ id: f.project.id, documentId: report.id }) })).status).toBe(409);
  });
  it("enforces body/origin/schema/time bounds and the shared archive quota", async () => {
    const f = await fixture(); const ctx = { params: Promise.resolve({ id: f.project.id }) };
    const crossSite = request(f, capture()); crossSite.headers.set("origin", "https://evil.invalid");
    expect((await POST(crossSite, ctx)).status).toBe(403);
    const large = request(f, { padding: "x".repeat(17000) });
    expect((await POST(large, ctx)).status).toBe(413);
    expect((await POST(request(f, { ...capture(), command: "rm -rf /" }), ctx)).status).toBe(400);
    await expect(archiveDeviceReport(f.user.id, f.project.id, { ...capture(), capturedAt: new Date(Date.now() - 86400001).toISOString() })).rejects.toMatchObject({ status: 400 });
    for (let i = 0; i < PROJECT_DOCUMENT_LIMIT; i++) {
      const started = Date.now(); await archiveDeviceReport(f.user.id, f.project.id, capture());
      expect(Date.now() - started).toBeLessThan(5000);
    }
    await expect(archiveDeviceReport(f.user.id, f.project.id, capture())).rejects.toMatchObject({ status: 409 });
  }, 20000); // Twenty real transactions over an SSH tunnel, not a larger per-request deadline.
  it("changes the project file revision on a new snapshot and refuses corrupt stored data", async () => {
    const f = await fixture(); const report = capture();
    await archiveDeviceReport(f.user.id, f.project.id, report);
    const first = await projectFilesForTurn(f.user.id, f.project.id);
    await archiveDeviceReport(f.user.id, f.project.id, capture());
    expect((await projectFilesForTurn(f.user.id, f.project.id)).revision).not.toBe(first.revision);
    await requireDb().update(projectDocuments).set({ fileSha256: "0".repeat(64) }).where(eq(projectDocuments.id, report.id));
    await expect(projectFilesForTurn(f.user.id, f.project.id)).rejects.toThrow("integrity mismatch");
  });
  it("accepts configured public origin behind a normalized internal URL without trusting forwarded headers", async () => {
    const f = await fixture(); const ctx = { params: Promise.resolve({ id: f.project.id }) };
    const proxied = () => new NextRequest(`http://127.0.0.1:3210/api/projects/${f.project.id}/device-reports`, {
      method: "POST", headers: { Cookie: f.cookie, "Content-Type": "application/json", Origin: "https://ldcx.tech" }, body: JSON.stringify(capture()),
    });
    vi.stubEnv("VIBEHARD_PUBLIC_ORIGIN", "https://ldcx.tech");
    expect((await POST(proxied(), ctx)).status).toBe(201);
    const hostile = proxied(); hostile.headers.set("origin", "https://evil.invalid"); hostile.headers.set("host", "evil.invalid"); hostile.headers.set("x-forwarded-host", "evil.invalid");
    expect((await POST(hostile, ctx)).status).toBe(403);
  });
});
