// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/server/retrieval-client", () => ({ queryPrivateIndex: vi.fn().mockResolvedValue({ sources: [], revision: "a".repeat(64) }), privateIndexRevision: vi.fn().mockResolvedValue("a".repeat(64)) }));
import { requireDb } from "@/lib/db";
import { runnerCommands, runnerNodes, sharedKnowledge, users } from "@/lib/db/schema";
import { createProject, createThread, createTurn, createUser, heartbeatRunner, ingestRunnerEvent, listEvents, registerRunner } from "@/lib/server/store";
import { claimDesign, enqueueDesign, finishDesign, getDesign, saveDesignDiagnostics } from "@/lib/server/design-job-store";
import { retrieveDesignKnowledge } from "@/lib/server/design-knowledge";
import { processNextDesign } from "@/lib/server/design-job-worker";
import { supplementDesignMaterials } from "@/lib/server/project-material-lock";
import { queryPrivateIndex } from "@/lib/server/retrieval-client";
import { mutateSharedKnowledge } from "@/lib/server/shared-knowledge-store";
import { designMarkdown } from "@/lib/agent/design-jobs";
import { envelope, type TaskStart } from "@/lib/agent/protocol";
import { knowledgeManifest } from "@/lib/agent/knowledge";

const enabled = process.env.VIBEHARD_DESIGN_TEST_DATABASE === "1";
if (enabled) {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/vibehard_design_test") throw Error("Refusing non-isolated material lock database");
}
(enabled ? describe : describe.skip)("project material locks with real PostgreSQL queue and Agent dispatch", () => {
  const people: string[] = []; const entries: string[] = []; const runners: string[] = [];
  afterEach(async () => {
    if (entries.length) await requireDb().delete(sharedKnowledge).where(inArray(sharedKnowledge.id, entries.splice(0)));
    if (people.length) await requireDb().delete(users).where(inArray(users.id, people.splice(0)));
    if (runners.length) await requireDb().delete(runnerNodes).where(inArray(runnerNodes.runnerKey, runners.splice(0)));
  });
  async function person(role: "member" | "developer" = "member") {
    const user = await createUser({ email: `lock-${randomUUID()}@example.invalid`, passwordHash: "fixture", inviteCode: "fixture" }); people.push(user.id);
    if (role === "developer") await requireDb().update(users).set({ role }).where(eq(users.id, user.id));
    return user.id;
  }
  it("persists a server-only lock, avoids a second FTS scan, then removes revoked excerpts and resets native context", async () => {
    const owner = await person(), outsider = await person(), reviewer = await person("developer");
    const runnerKey = `lock-${randomUUID()}`; runners.push(runnerKey);
    const registration = await registerRunner({ runnerKey, name: "Isolated lock runner", capabilities: ["project-knowledge-v1", "bounded-retrieval-v1", "project-design-files-v1"] }); await heartbeatRunner(runnerKey, registration.secret);
    const project = await createProject(owner, { name: "资料锁验收", workspaceKey: randomUUID(), runnerKey });
    const marker = `evidence-${randomUUID()}`;
    const draft = { title: "SHT40 数据手册", source: "SHT40/manual.md#part=1", kind: "manual" as const, content: `SHT40 I2C 参考，电气未验证。${marker}` };
    const entry = await mutateSharedKnowledge(reviewer, "manuals", { action: "create", draft }); entries.push(entry.id);
    const published = await mutateSharedKnowledge(reviewer, "manuals", { action: "publish", documentId: entry.id, expectedRevision: entry.document.revision, confirmed: true });
    const job = await enqueueDesign(owner, { requestId: randomUUID(), projectId: project.id, requirement: "SHT40 温度监测" });
    const callLlm = vi.fn().mockResolvedValue(JSON.stringify({ architecture: ["I2C"], bom: [{ item: "温度", model: "SHT40", qty: 1, estCost: "¥10 估算" }], interfaces: ["I2C"], risks: [{ level: "中", desc: "核验" }], materialsLock: { hash: "forged" } }));
    await processNextDesign({ claimDesign, finishDesign, saveDesignDiagnostics, retrieveDesignKnowledge, supplementDesignMaterials, callLlm,
      runtimeLlm: vi.fn().mockResolvedValue({ model: "fixture", baseUrl: "https://example.invalid", apiKey: "not-real", protocol: "responses", revision: randomUUID() }) });
    const saved = (await getDesign(owner, job.id))!; expect(saved.status).toBe("completed"); expect(callLlm).toHaveBeenCalledTimes(1);
    expect(saved.result?.materialsLock).toMatchObject({ projectId: project.id, designId: job.id, partial: false, references: [{ id: entry.id, version: 1 }] });
    const historical = designMarkdown(saved);
    expect(await getDesign(outsider, job.id)).toBeNull();
    await expect(supplementDesignMaterials({ userId: outsider, projectId: project.id, designId: job.id, bom: saved.result!.bom }, new AbortController().signal)).rejects.toThrow("无权访问");
    const thread = (await createThread(owner, project.id))!;
    async function task() {
      const turn = (await createTurn(owner, thread.id, "分析一下本项目", "fixture"))!;
      return (await requireDb().select().from(runnerCommands).where(eq(runnerCommands.taskId, turn.id)))[0].payload as unknown as TaskStart;
    }
    async function complete(start: TaskStart) {
      for (const type of ["task.started", "task.completed"] as const) await ingestRunnerEvent({ ...envelope(), type: "event", runnerKey, taskId: start.taskId, threadId: thread.id, codexThreadId: "native-lock-fixture",
        event: { eventId: randomUUID(), sequence: 0, timestamp: new Date().toISOString(), type, data: { knowledge: knowledgeManifest(start.knowledge!), design: start.design } } });
    }
    vi.mocked(queryPrivateIndex).mockClear(); const first = await task();
    expect(queryPrivateIndex).not.toHaveBeenCalled(); expect(first.design?.markdown).toContain(marker);
    expect((await listEvents(owner, thread.id))?.[0].payload).toMatchObject({ origin: "project-material-lock", materialLockState: "active" }); await complete(first);
    const edited = await mutateSharedKnowledge(reviewer, "manuals", { action: "edit", documentId: entry.id, expectedRevision: published.document.revision, draft: { ...draft, content: "SHT40 新草稿尚未发布" } });
    const second = await task(); expect(second.codexThreadId).toBe("native-lock-fixture"); expect(second.design?.markdown).toBe(first.design?.markdown); await complete(second);
    await mutateSharedKnowledge(reviewer, "manuals", { action: "disable", documentId: entry.id, expectedRevision: edited.document.revision });
    const third = await task(); expect(third.codexThreadId).toBeUndefined(); expect(third.retrieval?.references).toEqual([]);
    expect(third.design?.markdown).not.toContain(marker); expect(third.design?.markdown).toContain("资料锁状态：stale"); expect(queryPrivateIndex).toHaveBeenCalledTimes(1);
    expect(designMarkdown((await getDesign(owner, job.id))!)).toBe(historical);
    expect(await createTurn(outsider, thread.id, "读取资料", "fixture")).toBeNull();
  });
});
