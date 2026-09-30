import OSS from "ali-oss";
import { createHash } from "node:crypto";
import { SCHEMATIC_FILE_LIMIT } from "@/lib/agent/schematic";
import { projectOriginalKey } from "./project-document-key";
export { projectOriginalKey } from "./project-document-key";

export class ProjectStorageError extends Error {
  constructor() { super("项目原图归档服务暂不可用，请管理员检查私有 OSS 配置；未调用识别模型"); }
}
export class ProjectDownloadBusy extends Error {
  constructor() { super("原图下载繁忙，请稍后重试"); }
}
let originalReads = 0;
function client() {
  const bucket = process.env.OSS_PROJECT_BUCKET ?? process.env.OSS_KNOWLEDGE_BUCKET;
  const region = process.env.OSS_PROJECT_REGION ?? process.env.OSS_KNOWLEDGE_REGION;
  const accessKeyId = process.env.OSS_PROJECT_ACCESS_KEY_ID ?? process.env.OSS_KNOWLEDGE_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_PROJECT_ACCESS_KEY_SECRET ?? process.env.OSS_KNOWLEDGE_ACCESS_KEY_SECRET;
  const stsToken = process.env.OSS_PROJECT_STS_TOKEN;
  if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !region || !/^oss-[a-z0-9-]+$/.test(region) || !accessKeyId || !accessKeySecret) throw new ProjectStorageError();
  const options: OSS.Options & { retryMax: number } = { bucket, region, accessKeyId, accessKeySecret, stsToken, secure: true, authorizationV4: true, timeout: 15_000, retryMax: 0 };
  return new OSS(options);
}
export function assertProjectStorageConfigured() { client(); }
function validateKey(key: string) {
  const parts = key.split("/");
  if (parts.length !== 7 || parts.slice(0, 3).join("/") !== "projects/raw/v1" ||
    projectOriginalKey(parts[3], parts[4], parts[5], parts[6]) !== key) throw new ProjectStorageError();
}
export async function putProjectOriginal(key: string, bytes: Buffer, sha: string) {
  validateKey(key);
  if (!bytes.length || bytes.length > SCHEMATIC_FILE_LIMIT || createHash("sha256").update(bytes).digest("hex") !== sha) throw new ProjectStorageError();
  try {
    const storage = client();
    await storage.put(key, bytes, { headers: {
      "x-oss-object-acl": "private", "x-oss-forbid-overwrite": "true",
      "Content-Type": "application/octet-stream", "Content-Disposition": "attachment",
      "Content-MD5": createHash("md5").update(bytes).digest("base64"), "x-oss-meta-sha256": sha,
    } }).catch(error => { if (error.code !== "FileAlreadyExists") throw error; });
    const head = await storage.head(key);
    const headers = head.res.headers as Record<string, string>;
    if (Number(headers["content-length"]) !== bytes.length || headers["x-oss-meta-sha256"] !== sha) throw new Error("Checksum mismatch");
  } catch { throw new ProjectStorageError(); }
}
export async function getProjectOriginal(key: string, sha: string, byteSize: number) {
  validateKey(key);
  if (byteSize <= 0 || byteSize > SCHEMATIC_FILE_LIMIT) throw new ProjectStorageError();
  if (originalReads >= 2) throw new ProjectDownloadBusy();
  originalReads += 1;
  try {
    const response = await client().getStream(key);
    const chunks: Buffer[] = []; let size = 0;
    try {
      for await (const value of response.stream) {
        const bytes = Buffer.from(value); size += bytes.length;
        if (size > byteSize) throw new Error("Size mismatch");
        chunks.push(bytes);
      }
    } finally { response.stream.destroy(); }
    const bytes = Buffer.concat(chunks);
    if (size !== byteSize || createHash("sha256").update(bytes).digest("hex") !== sha) throw new Error("Checksum mismatch");
    return bytes;
  } catch { throw new Error("归档原图读取或校验失败，请稍后重试"); }
  finally { originalReads -= 1; }
}
