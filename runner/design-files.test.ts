// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { materializeDesign } from "./design-files";
import { designArtifactPath, type DesignArtifact } from "@/lib/agent/design-artifact";
import { projectArchive } from "@/lib/server/project-download";
import { unzipSync } from "fflate";

const roots: string[] = [];
async function root() { const value = await realpath(await mkdtemp(path.join(tmpdir(), "vibehard-design-files-"))); roots.push(value); return value; }
afterEach(async () => { for (const value of roots.splice(0)) await rm(value, { recursive: true, force: true }); });
function fixture(): DesignArtifact {
  const markdown = "# 硬件方案\n\n需求：温度节点\n\n## BOM\n- MCU\n";
  return { designId: randomUUID(), projectId: randomUUID(), markdown, sha256: createHash("sha256").update(markdown).digest("hex") };
}
it("materializes historical/new designs idempotently and includes them in the real project archive", async () => {
  const workspace = await root(); const artifact = fixture();
  const files = await Promise.all(Array.from({ length: 4 }, () => materializeDesign(workspace, artifact, artifact.projectId)));
  expect(new Set(files).size).toBe(1);
  expect(await readFile(path.join(workspace, files[0]), "utf8")).toBe(artifact.markdown);
  expect(await readdir(path.join(workspace, "designs"))).toEqual([path.basename(files[0])]);
  const archive = unzipSync(await projectArchive(path.dirname(workspace), path.basename(workspace)));
  expect(Buffer.from(archive[files[0]]).toString()).toBe(artifact.markdown);
});
it("rejects a different project or corrupt content before writing", async () => {
  const workspace = await root(); const artifact = fixture();
  await expect(materializeDesign(workspace, artifact, randomUUID())).rejects.toThrow("校验失败");
  await expect(materializeDesign(workspace, { ...artifact, markdown: "tampered" }, artifact.projectId)).rejects.toThrow("校验失败");
  expect(await readdir(workspace)).toEqual([]);
});
it("preserves edited files and rejects symlinked directories and files", async () => {
  const workspace = await root(); const outside = await root(); const artifact = fixture();
  await symlink(outside, path.join(workspace, "designs"));
  await expect(materializeDesign(workspace, artifact, artifact.projectId)).rejects.toThrow();
  expect(await readdir(outside)).toEqual([]);
  await rm(path.join(workspace, "designs"));
  const relative = await materializeDesign(workspace, artifact, artifact.projectId);
  await writeFile(path.join(workspace, relative), "user edits");
  await expect(materializeDesign(workspace, artifact, artifact.projectId)).rejects.toThrow("原文件已保留");
  expect(await readFile(path.join(workspace, relative), "utf8")).toBe("user edits");
  await rm(path.join(workspace, relative));
  const outsideFile = path.join(outside, "private.md"); await writeFile(outsideFile, artifact.markdown);
  await symlink(outsideFile, path.join(workspace, designArtifactPath(artifact)));
  await expect(materializeDesign(workspace, artifact, artifact.projectId)).rejects.toThrow();
  expect(await readFile(outsideFile, "utf8")).toBe(artifact.markdown);
});
