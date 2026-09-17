import { mkdtemp, mkdir, writeFile, symlink, link, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projectArchive } from "@/lib/server/project-download";
import { GET } from "@/app/api/projects/[id]/download/route";
import { createProject, createUser } from "@/lib/server/store";
import { AUTH_COOKIE, createSessionToken } from "@/lib/server/security";

const temporary: string[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const directory of temporary.splice(0)) await rm(directory, { recursive: true, force: true }); });

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "vibehard-download-"));
  temporary.push(directory);
  // macOS's /var alias must not look like a symlinked project workspace.
  const { realpath } = await import("node:fs/promises");
  const root = await realpath(directory);
  const user = await createUser({ email: `${crypto.randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "TEST" });
  const project = await createProject(user.id, { name: "Download test", workspaceKey: "firmware", runnerKey: "cloud-runner" });
  const workspace = path.join(root, project.workspaceKey);
  await mkdir(workspace, { recursive: true });
  await writeFile(path.join(workspace, "main.c"), "int main(void) { return 0; }\n");
  const cookie = `${AUTH_COOKIE}=${createSessionToken(user)}`;
  vi.stubEnv("ARTIFACT_WORKSPACE_ROOT", root);
  vi.stubEnv("ARTIFACT_RUNNER_KEY", "cloud-runner");
  return { root, workspace, project, cookie };
}

describe("cloud project download", () => {
  it("downloads the owner's source and build result as a zip", async () => {
    const { workspace, project, cookie } = await fixture();
    await mkdir(path.join(workspace, "build"));
    await writeFile(path.join(workspace, "build", "firmware.bin"), new Uint8Array([1, 2, 3]));
    const response = await GET(new NextRequest("http://localhost/download", { headers: { Cookie: cookie } }), { params: Promise.resolve({ id: project.id }) });
    expect(response.status).toBe(200);
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(strFromU8(files["main.c"])).toContain("int main");
    expect([...files["build/firmware.bin"]]).toEqual([1, 2, 3]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects guests, other users and projects on a different runner", async () => {
    const { project, cookie } = await fixture();
    const context = { params: Promise.resolve({ id: project.id }) };
    expect((await GET(new NextRequest("http://localhost/download"), context)).status).toBe(401);
    const outsider = await createUser({ email: `${crypto.randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "TEST" });
    expect((await GET(new NextRequest("http://localhost/download", { headers: { Cookie: `${AUTH_COOKIE}=${createSessionToken(outsider)}` } }), context)).status).toBe(403);
    vi.stubEnv("ARTIFACT_RUNNER_KEY", "different-runner");
    expect((await GET(new NextRequest("http://localhost/download", { headers: { Cookie: cookie } }), context)).status).toBe(409);
  });

  it("excludes secrets, symlinks, hardlinks and dependencies", async () => {
    const { root, workspace, project } = await fixture();
    await writeFile(path.join(root, "secret"), "do-not-export");
    await writeFile(path.join(workspace, ".env.local"), "KEY=secret");
    await mkdir(path.join(workspace, "node_modules"));
    await writeFile(path.join(workspace, "node_modules", "package.js"), "dependency");
    await symlink(path.join(root, "secret"), path.join(workspace, "linked-secret"));
    await symlink(root, path.join(workspace, "linked-directory"));
    await link(path.join(root, "secret"), path.join(workspace, "hardlink-secret"));
    expect(Object.keys(unzipSync(await projectArchive(root, project.workspaceKey)))).toEqual(["main.c"]);
  });

  it("rejects escaping and symlinked project roots and oversized files", async () => {
    const { root, workspace, project } = await fixture();
    await expect(projectArchive(root, "../elsewhere")).rejects.toMatchObject({ status: 400 });
    await symlink(workspace, path.join(root, "alias"));
    await expect(projectArchive(root, "alias")).rejects.toMatchObject({ status: 400 });
    await writeFile(path.join(workspace, "huge.bin"), Buffer.alloc(26 * 1024 * 1024));
    await expect(projectArchive(root, project.workspaceKey)).rejects.toMatchObject({ status: 413 });
  });
});
