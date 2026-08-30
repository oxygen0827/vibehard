import { describe, expect, it } from "vitest";
import { createProject, createThread, createUser, listThreads, resolveModelProfile } from "@/lib/server/store";

describe("tenant isolation", () => {
  it("阻止其他用户读取项目会话", async () => { const suffix = crypto.randomUUID(); const owner = await createUser({ email: `owner-${suffix}@example.com`, passwordHash: "test", inviteCode: "TEST" }); const outsider = await createUser({ email: `outsider-${suffix}@example.com`, passwordHash: "test", inviteCode: "TEST" }); const project = await createProject(owner.id, { name: "Private project", workspaceKey: `private-${suffix}` }); await createThread(owner.id, project.id, "Owner thread"); expect(project.workspaceKey).toMatch(new RegExp(`^${owner.id}/${project.id}-`)); expect(await listThreads(owner.id, project.id)).toHaveLength(1); expect(await listThreads(outsider.id, project.id)).toBeNull(); });

  it("只解析平台已启用且 provider 匹配的模型", async () => {
    await expect(resolveModelProfile("gpt-5.6-terra", "openai")).resolves.toMatchObject({ providerId: "openai" });
    await expect(resolveModelProfile("gpt-5.6-terra", "unknown")).resolves.toBeNull();
    await expect(resolveModelProfile("client-injected-model")).resolves.toBeNull();
  });
});
