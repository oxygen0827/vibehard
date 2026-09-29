import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, mkdir, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { designArtifactPath, designArtifactSchema, type DesignArtifact } from "@/lib/agent/design-artifact";

export async function materializeDesign(workspace: string, input: DesignArtifact, projectId: string) {
  const artifact = designArtifactSchema.parse(input);
  if (artifact.projectId !== projectId || createHash("sha256").update(artifact.markdown).digest("hex") !== artifact.sha256) {
    throw new Error("项目方案归属或内容校验失败，任务未执行");
  }
  if (await realpath(workspace) !== path.resolve(workspace)) throw new Error("项目目录不能包含符号链接");
  const directory = path.join(workspace, "designs");
  await mkdir(directory, { mode: 0o700 }).catch(error => { if (error.code !== "EEXIST") throw error; });
  const folder = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  let temporary: string | undefined;
  try {
    if (await realpath(directory) !== directory) throw new Error("方案目录不能包含符号链接");
    // Hold the directory descriptor on Linux so path swaps cannot redirect writes.
    const anchored = process.platform === "linux" ? `/proc/self/fd/${folder.fd}` : directory;
    const relativePath = designArtifactPath(artifact);
    const target = path.join(anchored, path.basename(relativePath));
    temporary = path.join(anchored, `.design-${randomUUID()}.tmp`);
    const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(artifact.markdown, "utf8"); await file.sync(); } finally { await file.close(); }
    try { await link(temporary, target); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const stored = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await stored.stat();
      // A concurrently published copy may still have its own temporary hardlink.
      if (!stat.isFile() || stat.size !== Buffer.byteLength(artifact.markdown)) throw new Error("方案文件已被修改，原文件已保留，请检查项目目录");
      const bytes = Buffer.alloc(stat.size);
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesRead } = await stored.read(bytes, offset, bytes.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      if (offset !== bytes.length || createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) throw new Error("方案文件已被修改，原文件已保留，请检查项目目录");
    } finally { await stored.close(); }
    return relativePath;
  } finally {
    if (temporary) await unlink(temporary).catch(() => undefined);
    await folder.close();
  }
}
