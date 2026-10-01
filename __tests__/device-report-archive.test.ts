// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { archivedFile } from "@/lib/server/project-documents";
import { projectFilePath, projectFilesManifest } from "@/lib/agent/project-document";
import { materializeProjectFiles } from "@/runner/project-files";
import { sample } from "./fixtures/device-report";
import { deviceReportSchema } from "@/lib/device/device-report";

it("materializes a device report at its server-derived immutable path and verifies its hash", async () => {
  const row = { id: sample.id, projectId: "00000000-0000-4000-8000-000000000092", fileSha256: createHash("sha256").update(JSON.stringify(deviceReportSchema.parse(sample))).digest("hex"),
    result: { type: "device-report", report: sample, receivedAt: "2026-10-01T02:51:00.000Z" } } as Parameters<typeof archivedFile>[0];
  const file = archivedFile(row);
  expect(file.kind).toBe("device-report");
  const payload = { files: [file], revision: createHash("sha256").update(JSON.stringify([[file.documentId, file.sha256]])).digest("hex") };
  const location = projectFilePath(file);
  expect(location).toBe(`documents/device-report-${sample.id}-${file.sha256.slice(0, 16)}.md`);
  expect(projectFilesManifest(payload).files[0].path).toBe(location);
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), "device-report-test-")));
  try {
    expect(await materializeProjectFiles(dir, payload, row.projectId)).toEqual([location]);
    expect(await readFile(path.join(dir, location), "utf8")).toContain("不是服务端可信设备身份");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
