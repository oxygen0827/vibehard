// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({ put: vi.fn(), head: vi.fn(), getStream: vi.fn(), configs: [] as Record<string, unknown>[] }));
vi.mock("ali-oss", () => ({ default: class {
  constructor(config: Record<string, unknown>) { sdk.configs.push(config); }
  put = sdk.put; head = sdk.head; getStream = sdk.getStream;
} }));
import { assertProjectStorageConfigured, getProjectOriginal, projectOriginalKey, putProjectOriginal } from "@/lib/server/project-document-storage";
const bytes = Buffer.from("private schematic fixture");
const sha = createHash("sha256").update(bytes).digest("hex");
const key = () => projectOriginalKey(randomUUID(), randomUUID(), randomUUID(), sha);
beforeEach(() => {
  vi.clearAllMocks(); sdk.configs.length = 0;
  vi.stubEnv("OSS_PROJECT_BUCKET", "test-private-bucket"); vi.stubEnv("OSS_PROJECT_REGION", "oss-cn-hangzhou");
  vi.stubEnv("OSS_PROJECT_ACCESS_KEY_ID", "fixture-id"); vi.stubEnv("OSS_PROJECT_ACCESS_KEY_SECRET", "fixture-secret");
  sdk.put.mockResolvedValue({}); sdk.head.mockResolvedValue({ res: { headers: { "content-length": String(bytes.length), "x-oss-meta-sha256": sha } } });
});
afterEach(() => vi.unstubAllEnvs());
it("uses private immutable uploads, checksum headers and HTTPS V4 without exposing storage URLs", async () => {
  const objectKey = key();
  expect(await putProjectOriginal(objectKey, bytes, sha)).toBeUndefined();
  expect(sdk.configs[0]).toMatchObject({ secure: true, authorizationV4: true, timeout: 15_000, retryMax: 0 });
  expect(sdk.put).toHaveBeenCalledWith(objectKey, bytes, { headers: expect.objectContaining({ "x-oss-object-acl": "private", "x-oss-forbid-overwrite": "true", "Content-Disposition": "attachment", "x-oss-meta-sha256": sha }) });
  sdk.put.mockRejectedValueOnce({ code: "FileAlreadyExists" });
  await putProjectOriginal(objectKey, bytes, sha); // Same immutable object can be verified after lost ACK.
  sdk.head.mockResolvedValueOnce({ res: { headers: { "content-length": "99" } } });
  await expect(putProjectOriginal(objectKey, bytes, sha)).rejects.toThrow("归档服务暂不可用");
});
it("checks download size/hash, never follows client object keys and hides provider error details", async () => {
  sdk.getStream.mockImplementation(async () => ({ stream: Readable.from([bytes]) }));
  expect(await getProjectOriginal(key(), sha, bytes.length)).toEqual(bytes);
  await expect(getProjectOriginal(key(), sha, bytes.length - 1)).rejects.toThrow("校验失败");
  await expect(getProjectOriginal(key(), "a".repeat(64), bytes.length)).rejects.toThrow("校验失败");
  await expect(putProjectOriginal("../../another-account", bytes, sha)).rejects.toThrow();
  sdk.put.mockRejectedValueOnce(new Error("fixture-secret provider internal details"));
  await expect(putProjectOriginal(key(), bytes, sha)).rejects.toThrow("归档服务暂不可用");
  vi.stubEnv("OSS_PROJECT_ACCESS_KEY_SECRET", "");
  expect(assertProjectStorageConfigured).toThrow("归档服务暂不可用");
});
