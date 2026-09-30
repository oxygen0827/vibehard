// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { materializeProjectFiles } from "./project-files";
import { CodexSession } from "./codex-stdio";
import { envelope, type AgentEvent } from "@/lib/agent/protocol";
import { projectFilePath, type ProjectFile } from "@/lib/agent/project-document";
import { projectArchive } from "@/lib/server/project-download";
import { unzipSync } from "fflate";
const roots: string[] = [];
async function root() { const value = await realpath(await mkdtemp(path.join(tmpdir(), "vibehard-doc-files-"))); roots.push(value); return value; }
afterEach(async () => { vi.unstubAllEnvs(); for (const value of roots.splice(0)) await rm(value, { recursive: true, force: true }); });
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function fixture() {
  const markdown = "# 私有识别资料\nSCHEMATIC_ARCHIVE_FIXTURE\nU1 图纸区域待确认";
  const file: ProjectFile = { documentId: randomUUID(), projectId: randomUUID(), title: "原理图", kind: "schematic", markdown, sha256: hash(markdown) };
  return { revision: hash(JSON.stringify([[file.documentId, file.sha256]])), files: [file] };
}
it("writes immutable project documents and a real Agent child process reads them before completing", async () => {
  const workspace = await root(); const payload = fixture(); const file = payload.files[0];
  vi.stubEnv("CODEX_BIN", process.execPath);
  vi.stubEnv("CODEX_APP_SERVER_ARGS", JSON.stringify([path.resolve("__tests__/fixtures/fake-codex.mjs")]));
  vi.stubEnv("CODEX_PROVIDER_ENV_ALLOWLIST", "FAKE_CODEX_MODE"); vi.stubEnv("FAKE_CODEX_MODE", "project-files");
  const events: AgentEvent[] = []; const session = new CodexSession(event => events.push(event), path.dirname(workspace));
  try {
    await session.start({ ...envelope(), type: "task.start", taskId: randomUUID(), threadId: randomUUID(), projectId: file.projectId, workspaceKey: workspace, input: "读取项目图纸", model: "fake", projectFiles: payload });
    await vi.waitFor(() => expect(events.some(event => event.type === "task.completed")).toBe(true));
    expect(events.some(event => event.type === "tool.completed" && (event.data.item as { exitCode?: number })?.exitCode === 0)).toBe(true);
    expect(events.find(event => event.type === "artifact.created")?.data).toMatchObject({ kind: "project_document", sha256: file.sha256, path: projectFilePath(file), review: "unreviewed" });
    expect(JSON.stringify(events)).not.toContain(file.markdown);
    await materializeProjectFiles(workspace, payload, file.projectId);
    const archive = unzipSync(await projectArchive(path.dirname(workspace), path.basename(workspace)));
    expect(Buffer.from(archive[projectFilePath(file)]).toString()).toBe(file.markdown);
  } finally { session.dispose(); }
});
it("rejects cross-project/corrupt payloads, symlinks and user-edited files without overwriting", async () => {
  const workspace = await root(); const outside = await root(); const payload = fixture(); const file = payload.files[0];
  await expect(materializeProjectFiles(workspace, payload, randomUUID())).rejects.toThrow("校验失败");
  await expect(materializeProjectFiles(workspace, { ...payload, revision: "a".repeat(64) }, file.projectId)).rejects.toThrow("校验失败");
  await symlink(outside, path.join(workspace, "documents"));
  await expect(materializeProjectFiles(workspace, payload, file.projectId)).rejects.toThrow();
  await rm(path.join(workspace, "documents"));
  await materializeProjectFiles(workspace, payload, file.projectId);
  await writeFile(path.join(workspace, projectFilePath(file)), "用户修改");
  await expect(materializeProjectFiles(workspace, payload, file.projectId)).rejects.toThrow("原文件已保留");
  expect(await readFile(path.join(workspace, projectFilePath(file)), "utf8")).toBe("用户修改");
});
