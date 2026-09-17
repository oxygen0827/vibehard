import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { zipSync } from "fflate";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const EXCLUDED = new Set(["node_modules", ".git", ".codex", ".env", ".runner"]);

export class DownloadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function inside(root: string, candidate: string) {
  return candidate.startsWith(`${root}${path.sep}`);
}

// The project key comes from an ownership-checked DB row, never from a URL path.
export async function projectArchive(root: string, workspaceKey: string) {
  const canonicalRoot = await realpath(root);
  const projectPath = path.resolve(canonicalRoot, workspaceKey);
  if (!inside(canonicalRoot, projectPath)) throw new DownloadError("工作区路径无效", 400);
  const project = await realpath(projectPath);
  if (project !== projectPath || !(await lstat(project)).isDirectory()) throw new DownloadError("工作区路径无效", 400);
  const files: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  let entries = 0;

  async function collect(directory: string, depth = 0) {
    if (depth > 24) throw new DownloadError("工程目录层级过深", 413);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (++entries > MAX_ENTRIES) throw new DownloadError("工程文件过多，请先清理构建缓存", 413);
      if (EXCLUDED.has(entry.name) || entry.name.startsWith(".") || entry.name.includes("\\")) continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (await realpath(candidate) !== candidate) throw new DownloadError("工程目录发生变化，请重试", 409);
        await collect(candidate, depth + 1);
      } else if (entry.isFile()) {
        const handle = await open(candidate, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
          // On Linux verify the opened descriptor, not just the pathname, so
          // concurrent parent-directory symlink swaps cannot expose host files.
          const opened = process.platform === "linux" ? await realpath(`/proc/self/fd/${handle.fd}`) : await realpath(candidate);
          if (!inside(project, opened)) throw new DownloadError("工程文件路径无效", 400);
          const stat = await handle.stat();
          if (!stat.isFile() || stat.nlink !== 1) continue;
          if (stat.size > MAX_BYTES - total) throw new DownloadError("工程超过 25 MB 下载上限", 413);
          const bytes = Buffer.alloc(stat.size);
          let offset = 0;
          while (offset < bytes.length) {
            const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (!bytesRead) break;
            offset += bytesRead;
          }
          if (offset !== stat.size || (await handle.stat()).size !== stat.size) throw new DownloadError("工程正在修改，请稍后重试", 409);
          files[path.relative(project, candidate).split(path.sep).join("/")] = new Uint8Array(bytes);
          total += bytes.length;
        } finally { await handle.close(); }
      }
    }
  }
  await collect(project);
  if (!Object.keys(files).length) throw new DownloadError("工程中还没有可下载的文件", 404);
  return zipSync(files, { level: 1 });
}
