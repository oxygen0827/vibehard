// @vitest-environment node
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireDb } from "@/lib/db";
import { projectDocuments, runnerNodes, users, projectKnowledge, runnerCommands } from "@/lib/db/schema";
import { createUser, createProject, createThread, createTurn, getQueuedRunnerCommands, registerRunner, ingestRunnerEvent } from "@/lib/server/store";
import { createSessionToken } from "@/lib/server/security";
import { POST } from "@/app/api/schematic/route";
import { GET as list } from "@/app/api/projects/[id]/documents/route";
import { GET as download } from "@/app/api/projects/[id]/documents/[documentId]/route";
import { beginProjectDocument, readProjectDocument, projectFilesForTurn } from "@/lib/server/project-documents";
import { PROJECT_FILES_CAPABILITY } from "@/lib/agent/project-document";
import { envelope, type AgentEvent, type TaskStart } from "@/lib/agent/protocol";
import { CodexSession } from "@/runner/codex-stdio";
import { callLlm } from "@/lib/server/llm-client";
import { putProjectOriginal } from "@/lib/server/project-document-storage";

const originals = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/lib/server/project-document-storage", async original => ({
  ...await original<typeof import("@/lib/server/project-document-storage")>(),
  assertProjectStorageConfigured: vi.fn(),
  putProjectOriginal: vi.fn(async (key: string, bytes: Buffer) => { originals.set(key, bytes); }),
  getProjectOriginal: vi.fn(async (key: string) => originals.get(key)),
}));
vi.mock("@/lib/server/llm-settings", async original => ({ ...await original<typeof import("@/lib/server/llm-settings")>(), runtimeLlm: vi.fn().mockResolvedValue({ model: "isolated-vision", baseUrl: "https://example.invalid", apiKey: "fixture-not-real", protocol: "responses" }) }));
vi.mock("@/lib/server/llm-client", async original => ({ ...await original<typeof import("@/lib/server/llm-client")>(), callLlm: vi.fn() }));
vi.mock("@/lib/server/retrieval-client", () => ({ queryPrivateIndex: vi.fn().mockResolvedValue({ sources: [], revision: "a".repeat(64) }), privateIndexRevision: vi.fn().mockResolvedValue("a".repeat(64)) }));
const enabled = process.env.VIBEHARD_DOCUMENT_TEST_DATABASE === "1";
if (enabled) {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/vibehard_documents_test") throw new Error("Refusing non-disposable archive test database");
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSm8AAAAASUVORK5CYII=", "base64");
const reply = JSON.stringify({ title: "合成原理图", markdown: "## 原图区域 U1\nSCHEMATIC_ARCHIVE_FIXTURE\nU1 接口与引脚待确认，不代表硬件验证。" });
(enabled ? describe : describe.skip)("owner-scoped schematic archive → Agent file handoff, real PostgreSQL", () => {
  const ids: string[] = []; const runners: string[] = []; const roots: string[] = [];
  beforeEach(() => { vi.mocked(callLlm).mockReset().mockResolvedValue(reply); originals.clear(); vi.mocked(putProjectOriginal).mockClear(); });
  afterEach(async () => {
    vi.unstubAllEnvs();
    if (ids.length) await requireDb().delete(users).where(inArray(users.id, ids.splice(0)));
    if (runners.length) await requireDb().delete(runnerNodes).where(inArray(runnerNodes.runnerKey, runners.splice(0)));
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });
  async function fixture() {
    const user = await createUser({ email: `archive-${randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "test" }); ids.push(user.id);
    const runnerKey = `archive-${randomUUID()}`; runners.push(runnerKey);
    await registerRunner({ runnerKey, name: "Archive fixture", capabilities: [PROJECT_FILES_CAPABILITY] });
    const project = await createProject(user.id, { name: "合成项目", workspaceKey: randomUUID(), runnerKey, model: "fake" });
    return { user, project, runnerKey, cookie: `vibehard_session=${createSessionToken(user)}` };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function upload(f: Fixture, id = randomUUID(), projectId = f.project.id) {
    const form = new FormData(); form.set("projectId", projectId); form.set("requestId", id); form.set("file", new File([png], "board.png", { type: "image/png" }));
    return new NextRequest("http://localhost/api/schematic", { method: "POST", body: form, headers: { Cookie: f.cookie } });
  }
  const readRequest = (f: Fixture, format = "") => new NextRequest(`http://localhost/api/documents${format}`, { headers: { Cookie: f.cookie } });
  async function recognize(f: Fixture, id = randomUUID()) {
    const response = await POST(upload(f, id));
    expect(response.status).toBe(200);
    return (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  }
  it("persists original and Markdown, replays the same request without billing twice, and the child Agent reads the archived file", async () => {
    const f = await fixture(); const id = randomUUID();
    const events = await recognize(f, id);
    const result = events.find(event => event.type === "result")?.result;
    expect(result?.archive).toMatchObject({ documentId: id, projectId: f.project.id });
    expect((await recognize(f, id)).at(-1).result).toEqual(result);
    expect(callLlm).toHaveBeenCalledTimes(1); expect(putProjectOriginal).toHaveBeenCalledTimes(1);
    const ctx = { params: Promise.resolve({ id: f.project.id, documentId: id }) };
    expect(Buffer.from(await (await download(readRequest(f, "?format=source"), ctx)).arrayBuffer())).toEqual(png);
    const md = await download(readRequest(f), ctx);
    expect(md.headers.get("content-disposition")).toContain("attachment");
    expect(await md.text()).toContain("SCHEMATIC_ARCHIVE_FIXTURE");
    expect(await requireDb().select().from(projectKnowledge).where(eq(projectKnowledge.projectId, f.project.id))).toEqual([]);

    const thread = (await createThread(f.user.id, f.project.id))!;
    const turn = (await createTurn(f.user.id, thread.id, "分析项目资料", "fake"))!;
    const task = (await getQueuedRunnerCommands(f.runnerKey))[0].payload as unknown as TaskStart;
    expect(task.projectFiles?.files).toHaveLength(1);
    const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "vibehard-doc-e2e-"))); roots.push(workspace);
    vi.stubEnv("CODEX_BIN", process.execPath); vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
    vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE"); vi.stubEnv("FAKE_CODEX_MODE", "project-files");
    const output: AgentEvent[] = []; const session = new CodexSession(event => output.push(event), path.dirname(workspace));
    try {
      await session.start({ ...task, workspaceKey: workspace });
      await vi.waitFor(() => expect(output.some(event => event.type === "task.completed")).toBe(true));
      for (const event of output) await ingestRunnerEvent({ ...envelope(), type: "event", runnerKey: f.runnerKey, taskId: turn.id, threadId: thread.id, codexThreadId: "native-archive", event });
    } finally { session.dispose(); }
    const listing = await (await list(readRequest(f), ctx)).json();
    expect(listing.documents[0]).toMatchObject({ status: "completed", syncedAt: expect.any(String), path: result.archive.path });
    expect(JSON.stringify(listing)).not.toContain("projects/raw/");
    // Unchanged archive keeps context; adding a new source resets it.
    const unchangedThread = (await createThread(f.user.id, f.project.id))!;
    await requireDb().update(runnerNodes).set({ capabilities: [] }).where(eq(runnerNodes.runnerKey, f.runnerKey));
    await expect(createTurn(f.user.id, unchangedThread.id, "read", "fake")).rejects.toThrow("资料同步");
    await requireDb().update(runnerNodes).set({ capabilities: [PROJECT_FILES_CAPABILITY] }).where(eq(runnerNodes.runnerKey, f.runnerKey));
    await recognize(f);
    const nextTurn = (await createTurn(f.user.id, thread.id, "读取新资料", "fake"))!;
    const next = (await requireDb().select().from(runnerCommands).where(eq(runnerCommands.taskId, nextTurn.id)))[0].payload;
    expect(next.codexThreadId).toBeUndefined();
    expect((next.projectFiles as TaskStart["projectFiles"])?.files).toHaveLength(2);
  });
  it("rejects another user's project before storage/model and denies its list, downloads and task payload", async () => {
    const owner = await fixture(); const outsider = await fixture(); const id = randomUUID();
    expect((await POST(upload(outsider, id, owner.project.id))).status).toBe(404);
    expect(callLlm).not.toHaveBeenCalled(); expect(putProjectOriginal).not.toHaveBeenCalled();
    await recognize(owner, id);
    const ctx = { params: Promise.resolve({ id: owner.project.id, documentId: id }) };
    expect((await list(readRequest(outsider), ctx)).status).toBe(404);
    expect((await download(readRequest(outsider, "?format=source"), ctx)).status).toBe(404);
    expect((await projectFilesForTurn(outsider.user.id, owner.project.id)).files).toEqual([]);
  });
  it("does not mark a document synchronized for forged paths, hashes, or another runner", async () => {
    const f = await fixture(); const id = randomUUID();
    const result = (await recognize(f, id)).find(event => event.type === "result").result;
    const thread = (await createThread(f.user.id, f.project.id))!;
    const turn = (await createTurn(f.user.id, thread.id, "读取资料", "fake"))!;
    const task = (await getQueuedRunnerCommands(f.runnerKey))[0].payload as unknown as TaskStart;
    const file = task.projectFiles!.files[0];
    for (const forged of [
      { runnerKey: f.runnerKey, path: "../../outside.md", sha256: file.sha256 },
      { runnerKey: f.runnerKey, path: result.archive.path, sha256: "f".repeat(64) },
      { runnerKey: "different-runner", path: result.archive.path, sha256: file.sha256 },
    ]) {
      await ingestRunnerEvent({ ...envelope(), type: "event", runnerKey: forged.runnerKey, taskId: turn.id, threadId: thread.id,
        event: { eventId: randomUUID(), timestamp: new Date().toISOString(), sequence: 0, type: "artifact.created", data: { kind: "project_document", documentId: id, path: forged.path, sha256: forged.sha256 } } });
    }
    const listing = await (await list(readRequest(f), { params: Promise.resolve({ id: f.project.id }) })).json();
    expect(listing.documents[0]).toMatchObject({ status: "completed", syncedAt: null });
  });
  it("does not call the model or claim success after OSS failure; a failed row remains inspectable", async () => {
    const f = await fixture(); const id = randomUUID();
    vi.mocked(putProjectOriginal).mockRejectedValueOnce(new Error("private internal credential detail"));
    const events = await recognize(f, id);
    expect(events.some(event => event.type === "error")).toBe(true);
    expect(events.some(event => event.type === "result")).toBe(false);
    expect(callLlm).not.toHaveBeenCalled();
    const row = await readProjectDocument(f.user.id, f.project.id, id);
    expect(row).toMatchObject({ status: "failed", originalStored: false, result: null });
    expect(row?.error).not.toContain("credential");
  });
  it("serializes duplicate reservations and rejects a reused id for a different target", async () => {
    const f = await fixture(); const input = { id: randomUUID(), fileName: "board.png", sha256: "a".repeat(64), mimeType: "image/png", byteSize: 10 };
    const values = await Promise.all([beginProjectDocument(f.user.id, f.project.id, input), beginProjectDocument(f.user.id, f.project.id, input)]);
    expect(values.filter(v => v.created)).toHaveLength(1);
    await expect(beginProjectDocument(f.user.id, f.project.id, { ...input, sha256: "b".repeat(64) })).rejects.toThrow("编号冲突");
    expect(await requireDb().select().from(projectDocuments).where(and(eq(projectDocuments.projectId, f.project.id), eq(projectDocuments.id, input.id)))).toHaveLength(1);
  });
});
