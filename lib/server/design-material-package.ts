import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import { designMarkdown, type DesignJob } from "@/lib/agent/design-jobs";
import { materialReportMarkdown, MATERIAL_CHECK_BOUNDARY } from "@/lib/agent/design-materials";
import { projectBomCsv } from "./project-bom";

// A small reproducible reference package, not an OSS download or firmware bundle.
// No paths are accepted from a user, model, filename or source label.
export function designMaterialPackage(job: DesignJob) {
  if (job.status !== "completed" || !job.result) throw new Error("方案尚未生成");
  const result = job.result;
  const texts: Record<string, string> = {
    "README.md": `# 项目资料包\n\n项目：${job.projectName}\n方案编号：${job.id}\n\n${MATERIAL_CHECK_BOUNDARY}\n\n这是生成时的历史快照，不包含 OSS 原件或固件。资料停用/更新后需重新核验，不作为持续访问授权。自动索引资料未人工复核。\n\n- requirements.md：用户需求\n- designs/design.md：方案及来源\n- bom.csv：该方案 BOM（历史方案没有价格快照时使用当前参考价）\n- materials/check.md：配套检查\n- references/：有界来源摘录\n- manifest.json：项目/方案绑定、路径、包中文件 SHA256 和检索来源记录 SHA256（两者不同；来源记录哈希可能对应已发布知识版本，不一概视为原始 PDF 哈希）\n`,
    "requirements.md": `# 用户需求\n\n${job.requirement}\n`,
    "designs/design.md": designMarkdown(job),
    "bom.csv": projectBomCsv({ projectId: job.projectId, projectName: job.projectName, designId: job.id,
      completedAt: job.completedAt ?? "未记录", model: job.model, priceRecorded: result.bom.every(item => !!item.referencePrice), items: result.bom }),
    "materials/check.md": result.materials ? materialReportMarkdown(result.materials) : "# 资料配套检查\n\n历史方案未记录检查结果，不能推断资料完整性。\n",
  };
  const references = (result.retrieval?.references ?? []).map((reference, index) => {
    const file = `references/source-${String(index + 1).padStart(2, "0")}.md`;
    texts[file] = `# ${reference.title}\n\n版本：${reference.version}\n来源位置：${reference.source}\n检索来源记录 SHA256：${reference.sha256}\n审核标识：${reference.reviewStatus === "auto-indexed" ? "未人工复核" : "生成时已发布，适配性未验证"}\n\n## 生成时摘录（非完整正文）\n\n${reference.excerpt}\n`;
    return { file, scope: reference.scope, id: reference.id, version: reference.version, source: reference.source,
      sourceSha256: reference.sha256, reviewStatus: reference.reviewStatus ?? "published-at-generation" };
  });
  const files = Object.entries(texts).map(([path, content]) => ({ path, bytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") }));
  texts["manifest.json"] = JSON.stringify({ format: "project-materials-v1", projectId: job.projectId, designId: job.id,
    generatedAt: job.completedAt, retrievalStatus: result.retrieval?.status ?? "unrecorded", files, references }, null, 2);
  if (Object.values(texts).reduce((total, value) => total + Buffer.byteLength(value), 0) > 512 * 1024) throw new Error("资料包超过 512 KiB 上限");
  // Fixed ZIP metadata makes repeated downloads hash-stable for the same input.
  return zipSync(Object.fromEntries(Object.entries(texts).map(([name, content]) => [name, [strToU8(content), { mtime: new Date(2020, 0, 1) }]])), { level: 1 });
}
