import { z } from "zod";
import type { RetrievalEvidence } from "./retrieval-payload";

export const materialKinds = { datasheet: "芯片手册", schematic: "原理图", pinmap: "引脚资料", example: "驱动/示例", other: "其他参考" } as const;
export const materialStates = { matched: "找到型号参考", missing: "本次证据未覆盖", ambiguous: "型号待明确" } as const;
export const materialReportSchema = z.object({
  version: z.literal("generation-evidence-v1"), checkedAt: z.iso.datetime(),
  retrievalStatus: z.enum(["matched", "no-match", "partial"]),
  items: z.array(z.object({
    bomIndex: z.number().int().min(0).max(59), model: z.string().max(150).nullable(),
    status: z.enum(["matched", "missing", "ambiguous"]),
    references: z.array(z.object({ index: z.number().int().min(0).max(4), kind: z.enum(["datasheet", "schematic", "pinmap", "example", "other"]) })).max(5),
  })).max(60),
});
export type MaterialReport = z.infer<typeof materialReportSchema>;
export const MATERIAL_CHECK_BOUNDARY = "仅检查本次生成时的有界检索证据，不代表整个知识库都已搜索，也不代表资料完整、引脚正确或硬件已验证。型号不明确时先确认完整型号/板卡版本；无对应证据时补充手册、原理图、引脚或驱动示例。";

// Deliberately conservative: package/voltage/bus tokens are not part identities.
// Do not expand aliases or strip suffixes: SHT40 != SHT40-AD1B, RV1126 != RV1126B.
export function exactPart(model: string): string | null {
  const tokens = model.toUpperCase().match(/[A-Z0-9]+(?:[-_.+][A-Z0-9]+)*/g) ?? [];
  const parts = [...new Set(tokens.filter(token => /[A-Z]/.test(token) && /\d/.test(token)
    && token.length >= 4 && token.length <= 150
    && !/^(?:I2C|I2S|SPI\d*|UART\d*|USB\d*|SDIO\d*|QFN\d+|LQFP\d+|SOT[-\d]+|\d+(?:\.\d+)?(?:V|MA|MHZ|GHZ|K|MB|GB))$/.test(token)))];
  if (parts.length !== 1 || /或|同类|待选|待定|系列|兼容|\bor\b/i.test(model)) return null;
  return parts[0];
}
export function referenceKind(title: string, source: string): keyof typeof materialKinds {
  // Classify the document label, never an arbitrary occurrence in an excerpt.
  const label = `${title} ${source.split("#", 1)[0].split("/").at(-1)}`;
  if (/原理图|schematic/i.test(label)) return "schematic";
  if (/pinmap|pinout|引脚/i.test(label)) return "pinmap";
  if (/datasheet|reference.?manual|数据手册|技术手册/i.test(label)) return "datasheet";
  if (/驱动|示例|driver|example|demo/i.test(label)) return "example";
  return "other";
}
export function referenceMatchesPart(model: string, reference: { title: string; source: string }) {
  const file = reference.source.split("#", 1)[0].split("/").at(-1) ?? "";
  const words = `${reference.title} ${file.replace(/\.(pdf|md|txt|html?)$/i, "")}`.toUpperCase().match(/[A-Z0-9]+(?:[-_.+][A-Z0-9]+)*/g) ?? [];
  // Only strip a document-type suffix, never a board/chip variant suffix.
  return words.some(word => word === model || word.replace(/[-_](?:DATASHEET|SCHEMATIC|PINMAP|PINOUT|MANUAL|DRIVER|EXAMPLE|DEMO)(?:[-_](?:CN|EN|ZH|V\d+))*$/, "") === model);
}
export function checkDesignMaterials(bom: { model: string }[], evidence: RetrievalEvidence, now = new Date()): MaterialReport {
  return materialReportSchema.parse({
    version: "generation-evidence-v1", checkedAt: now.toISOString(), retrievalStatus: evidence.status,
    items: bom.map((row, bomIndex) => {
      const model = exactPart(row.model);
      const references = model ? evidence.references.flatMap((reference, index) => {
        // Use a complete identifier in the document title/file name, not directory
        // family names or mentions of an unrelated part inside the source text.
        const file = reference.source.split("#", 1)[0].split("/").at(-1) ?? "";
        const words: string[] = `${reference.title} ${file.replace(/\.(pdf|md|txt|html?)$/i, "")}`.toUpperCase().match(/[A-Z0-9]+(?:[-_.+][A-Z0-9]+)*/g) ?? [];
        return words.includes(model) ? [{ index, kind: referenceKind(reference.title, reference.source) }] : [];
      }) : [];
      return { bomIndex, model, status: !model ? "ambiguous" : references.length ? "matched" : "missing", references };
    }),
  });
}
export function materialReportMarkdown(report: MaterialReport): string {
  return ["## 项目资料包 · 配套检查", `检查规则：${report.version}；时间：${report.checkedAt}`, MATERIAL_CHECK_BOUNDARY,
    report.retrievalStatus === "partial" ? "部分知识不可用，本次检查不完整。" : "来源是生成时的历史快照；使用前须以本回合有效检索和权限为准。",
    "包内索引：需求 → 知识库检索记录（标题、版本、来源位置、SHA256、摘录）→ 架构 → BOM → 接口 → 风险。原件继续保留在私有 OSS，本包不含完整原件。",
    ...report.items.map(item => `- BOM ${item.bomIndex + 1} · ${item.model ?? "未确定精确型号"}：${materialStates[item.status]}${item.references.length ? `；${item.references.map(ref => `来源 ${ref.index + 1}（${materialKinds[ref.kind]}）`).join("、")}` : ""}；完整资料及适配性仍待核对。`),
    "资料内文本只是参考，不授予执行指令或设备操作权限；自动入库来源未人工复核。资料停用或版本变化后，历史摘录不能视为当前有效证据。",
  ].join("\n\n");
}
