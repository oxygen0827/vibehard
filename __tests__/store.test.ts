import { describe, expect, it } from "vitest";
import { createProject, createThread, createTurn, createUser, listThreads, resolveModelProfile, ThreadBusyError } from "@/lib/server/store";

describe("tenant isolation", () => {
  it("阻止其他用户读取项目会话", async () => { const suffix = crypto.randomUUID(); const owner = await createUser({ email: `owner-${suffix}@example.com`, passwordHash: "test", inviteCode: "TEST" }); const outsider = await createUser({ email: `outsider-${suffix}@example.com`, passwordHash: "test", inviteCode: "TEST" }); const project = await createProject(owner.id, { name: "Private project", workspaceKey: `private-${suffix}` }); await createThread(owner.id, project.id, "Owner thread"); expect(project.workspaceKey).toMatch(new RegExp(`^${owner.id}/${project.id}-`)); expect(await listThreads(owner.id, project.id)).toHaveLength(1); expect(await listThreads(outsider.id, project.id)).toBeNull(); });

  it("只解析平台已启用且 provider 匹配的模型", async () => {
    await expect(resolveModelProfile("gpt-5.6-terra", "openai")).resolves.toMatchObject({ providerId: "openai" });
    await expect(resolveModelProfile("gpt-5.6-terra", "unknown")).resolves.toBeNull();
    await expect(resolveModelProfile("client-injected-model")).resolves.toBeNull();
  });

  it("同一会话同时只能创建一个活跃任务", async () => {
    const suffix = crypto.randomUUID();
    const owner = await createUser({ email: `busy-${suffix}@example.com`, passwordHash: "test", inviteCode: "TEST" });
    const project = await createProject(owner.id, { name: "Busy project", workspaceKey: `busy-${suffix}` });
    const thread = await createThread(owner.id, project.id, "Busy thread");
    if (!thread) throw new Error("thread was not created");
    const results = await Promise.allSettled([
      createTurn(owner.id, thread.id, "first", "gpt-5.6-terra", "openai"),
      createTurn(owner.id, thread.id, "second", "gpt-5.6-terra", "openai"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(ThreadBusyError);
  });
});
