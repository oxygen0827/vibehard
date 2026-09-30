// @vitest-environment node
import { expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";
import { checkDesignMaterials, exactPart } from "@/lib/agent/design-materials";
import { designMaterialPackage } from "@/lib/server/design-material-package";
import { designMarkdown, type DesignJob } from "@/lib/agent/design-jobs";
import type { RetrievalEvidence } from "@/lib/agent/retrieval-payload";

const evidence: RetrievalEvidence = { status: "matched", method: "keyword-chunks-fts5-v1", references: [
  { id: randomUUID(), scope: "platform", title: "SHT40 数据手册", source: "SHT40/manual.pdf#page=2&part=1", version: 2, sha256: "a".repeat(64), excerpt: "未核实参数", reviewStatus: "auto-indexed" },
  { id: randomUUID(), scope: "platform", title: "RV1126B pinmap", source: "RV1126B/pins.md", version: 1, sha256: "b".repeat(64), excerpt: "SHT30 是别的器件，不应关联" },
] };
export function sampleJob(): DesignJob {
  const bom = [{ item: "温度", model: "SHT40", qty: 1, estCost: "¥10（估算）" }];
  return { id: randomUUID(), projectId: randomUUID(), projectName: "资料工程", requirement: "温度检测", status: "completed", model: "test-model",
    knowledgeVersion: "test", result: { architecture: ["I2C"], bom, interfaces: ["I2C"], risks: [{ level: "中", desc: "待核验" }], retrieval: evidence,
      materials: checkDesignMaterials(bom, evidence, new Date("2026-09-30T00:00:00Z")) }, error: null,
    createdAt: "2026-09-30T00:00:00Z", startedAt: null, completedAt: "2026-09-30T00:00:00Z", deadlineAt: "2026-09-30T00:01:30Z" };
}
it("requires complete single models and rejects alternatives, generic buses and suffix confusion", () => {
  expect(exactPart("RV1126B 主控")).toBe("RV1126B");
  for (const model of ["SHT40/SHT30", "SHT40 或同类", "I2C USB2 QFN24", "电源待选", "ESP32-S3 系列"]) expect(exactPart(model)).toBeNull();
  const report = checkDesignMaterials(["SHT40", "SHT30", "RV1126", "RV1126B", "SHT40-AD1B", "SHT40/SHT30"].map(model => ({ model })), evidence);
  expect(report.items.map(item => item.status)).toEqual(["matched", "missing", "missing", "matched", "missing", "ambiguous"]);
  expect(report.items[0].references).toEqual([{ index: 0, kind: "datasheet" }]);
  expect(report.items[3].references).toEqual([{ index: 1, kind: "pinmap" }]);
});
it("does not associate a document just because its directory or excerpt names a part", () => {
  const unrelated = { ...evidence, references: [{ ...evidence.references[0], title: "README", source: "SHT40/README.md", excerpt: "SHT40" }] };
  expect(checkDesignMaterials([{ model: "SHT40" }], unrelated).items[0].status).toBe("missing");
  expect(checkDesignMaterials([{ model: "SHT40" }], { ...evidence, status: "partial" }).retrievalStatus).toBe("partial");
});
it("creates a bounded deterministic ZIP with source and actual file hashes, not arbitrary source paths", () => {
  const job = sampleJob(); job.result!.retrieval!.references[0].source = "../../secret.pdf#page=2";
  const zip = designMaterialPackage(job); expect(zip).toEqual(designMaterialPackage(job));
  const entries = unzipSync(zip); const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
  expect(manifest).toMatchObject({ projectId: job.projectId, designId: job.id, references: [{ sourceSha256: "a".repeat(64), reviewStatus: "auto-indexed" }, { sourceSha256: "b".repeat(64) }] });
  for (const file of manifest.files) {
    expect(file.path).not.toContain("..");
    expect(entries[file.path].length).toBe(file.bytes);
    expect(createHash("sha256").update(entries[file.path]).digest("hex")).toBe(file.sha256);
  }
  expect(strFromU8(entries["references/source-01.md"])).toContain("未人工复核");
  expect(strFromU8(entries["designs/design.md"])).toBe(designMarkdown(job));
  expect(strFromU8(entries["materials/check.md"])).toContain("来源 1（芯片手册）");
});
it("does not invent historical checks, and rejects unfinished or oversized packages", () => {
  const job = sampleJob(); delete job.result!.materials;
  expect(designMarkdown(job)).not.toContain("项目资料包 · 配套检查");
  expect(strFromU8(unzipSync(designMaterialPackage(job))["materials/check.md"])).toContain("历史方案未记录");
  expect(() => designMaterialPackage({ ...job, status: "failed" })).toThrow("尚未生成");
  expect(() => designMaterialPackage({ ...job, requirement: "x".repeat(512 * 1024) })).toThrow("512 KiB");
});
