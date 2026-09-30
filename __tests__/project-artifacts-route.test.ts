import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { GET } from "@/app/api/projects/[id]/artifacts/route";
import { createProject, createUser } from "@/lib/server/store";
import { AUTH_COOKIE, createSessionToken } from "@/lib/server/security";

it("shows only an owned project's artifact metadata, even when it has no conversation", async () => {
  const owner = await createUser({ email: `owner-${crypto.randomUUID()}@example.com`, passwordHash: "test", inviteCode: "TEST" });
  const stranger = await createUser({ email: `stranger-${crypto.randomUUID()}@example.com`, passwordHash: "test", inviteCode: "TEST" });
  const project = await createProject(owner.id, { name: "Project artifacts", workspaceKey: `artifact-${crypto.randomUUID()}` });
  const context = { params: Promise.resolve({ id: project.id }) };
  const request = (cookie?: string) => new NextRequest(`http://localhost/api/projects/${project.id}/artifacts`, { headers: cookie ? { Cookie: cookie } : {} });

  expect((await GET(request(), context)).status).toBe(401);
  expect((await GET(request(`${AUTH_COOKIE}=${createSessionToken(stranger)}`), context)).status).toBe(403);
  const own = await GET(request(`${AUTH_COOKIE}=${createSessionToken(owner)}`), context);
  expect(own.status).toBe(200);
  await expect(own.json()).resolves.toEqual({ artifacts: [] });
});
