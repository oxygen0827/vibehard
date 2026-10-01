import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db, requireDb } from "@/lib/db";
import { projects, projectDocuments } from "@/lib/db/schema";
import { schematicResultSchema, type SchematicResult } from "@/lib/agent/schematic";
import { DEVICE_REPORT_CAPABILITY, PROJECT_DOCUMENT_LIMIT, PROJECT_FILES_CAPABILITY, projectFilePath, projectFileSchema, projectFilesSchema, type ProjectDocumentSummary, type ProjectFile } from "@/lib/agent/project-document";
import { archivedDeviceReportSchema, deviceReportMarkdown, deviceReportSchema, type DeviceReport } from "@/lib/device/device-report";
import { projectOriginalKey } from "./project-document-key";
import { LlmRequestError } from "./llm-client";

type Row = typeof projectDocuments.$inferSelect;
type Reader = Pick<ReturnType<typeof requireDb>, "select">;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const ownerScope = (userId: string, projectId: string) => and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projectDocuments.userId, projects.userId));
export async function beginProjectDocument(userId: string, projectId: string, input: { id: string; fileName: string; sha256: string; mimeType: string; byteSize: number }) {
  if (!db) throw new LlmRequestError("项目归档需要持久数据库，请管理员配置后重试；尚未调用模型", 503);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`archive-id:${input.id}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${projectId}`}))`);
    const owner = (await tx.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1))[0];
    if (!owner) throw new LlmRequestError("项目不存在或无权访问", 404);
    const existing = (await tx.select().from(projectDocuments).where(eq(projectDocuments.id, input.id)).limit(1))[0];
    if (existing) {
      if (existing.userId !== userId || existing.projectId !== projectId || existing.fileSha256 !== input.sha256 || existing.mimeType !== input.mimeType) throw new LlmRequestError("识别请求编号冲突，请重新选择文件", 409);
      return { document: existing, created: false };
    }
    const total = (await tx.select({ n: count() }).from(projectDocuments).where(eq(projectDocuments.projectId, projectId)))[0].n;
    if (total >= PROJECT_DOCUMENT_LIMIT) throw new LlmRequestError(`本项目已达到首版 ${PROJECT_DOCUMENT_LIMIT} 份项目资料归档上限，请整理项目后再识别`, 409);
    const document = (await tx.insert(projectDocuments).values({ id: input.id, userId, projectId, fileName: input.fileName,
      fileSha256: input.sha256, mimeType: input.mimeType, byteSize: input.byteSize,
      objectKey: projectOriginalKey(userId, projectId, input.id, input.sha256) }).returning())[0];
    return { document, created: true };
  });
}
export async function markOriginalStored(id: string) {
  await requireDb().update(projectDocuments).set({ originalStored: true, updatedAt: new Date() }).where(eq(projectDocuments.id, id));
}
export function archivedFile(row: Row) {
  if (row.result && "type" in row.result && row.result.type === "device-report") {
    const saved = archivedDeviceReportSchema.parse(row.result);
    if (saved.report.id !== row.id || hash(JSON.stringify(saved.report)) !== row.fileSha256) throw new Error("Device report integrity mismatch");
    const markdown = deviceReportMarkdown(saved.report, saved.receivedAt);
    return projectFileSchema.parse({ documentId: row.id, projectId: row.projectId, title: "RV1126B 设备只读诊断报告", kind: "device-report", markdown, sha256: hash(markdown) });
  }
  const result = schematicResultSchema.parse(row.result);
  const markdown = `# ${result.draft.title}\n\n资料类型：本项目私有原理图识别（未人工复核）\n分析编号：${row.id}\n原文件：${JSON.stringify(row.fileName)}\n原图 SHA256：${row.fileSha256}\n识别模型：${result.model}\n识别时间：${result.generatedAt}\n原图存于私有 OSS，可在项目资料页下载核对。\n\n${result.draft.content}\n`;
  return projectFileSchema.parse({ documentId: row.id, projectId: row.projectId, title: result.draft.title, kind: "schematic", markdown, sha256: hash(markdown) });
}
export async function completeProjectDocument(id: string, result: SchematicResult) {
  const database = requireDb();
  const row = (await database.select().from(projectDocuments).where(eq(projectDocuments.id, id)).limit(1))[0];
  if (!row?.originalStored || row.status !== "processing" || result.analysisId !== id || result.fileSha256 !== row.fileSha256 || result.fileName !== row.fileName) throw new Error("Archive source mismatch");
  const file = archivedFile({ ...row, result });
  const saved = schematicResultSchema.parse({ ...result, archive: { projectId: row.projectId, documentId: row.id, path: projectFilePath(file) } });
  const completed = await database.update(projectDocuments).set({ status: "completed", result: saved, updatedAt: new Date() })
    .where(and(eq(projectDocuments.id, id), eq(projectDocuments.status, "processing"))).returning({ id: projectDocuments.id });
  if (!completed.length) throw new Error("Archive state changed");
  return saved;
}
export async function failProjectDocument(id: string, message: string) {
  await requireDb().update(projectDocuments).set({ status: "failed", error: message.slice(0, 300), updatedAt: new Date() })
    .where(and(eq(projectDocuments.id, id), eq(projectDocuments.status, "processing")));
}
export async function readProjectDocument(userId: string, projectId: string, id: string) {
  return (await requireDb().select({ document: projectDocuments }).from(projectDocuments).innerJoin(projects, eq(projects.id, projectDocuments.projectId))
    .where(and(ownerScope(userId, projectId), eq(projectDocuments.id, id))).limit(1))[0]?.document ?? null;
}
export async function listProjectDocuments(userId: string, projectId: string): Promise<ProjectDocumentSummary[] | null> {
  const database = requireDb();
  if (!(await database.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1))[0]) return null;
  const rows = await database.select({ document: projectDocuments }).from(projectDocuments).innerJoin(projects, eq(projects.id, projectDocuments.projectId))
    .where(ownerScope(userId, projectId)).orderBy(desc(projectDocuments.createdAt)).limit(PROJECT_DOCUMENT_LIMIT);
  return rows.map(({ document: row }) => ({
    id: row.id, projectId, title: row.result ? archivedFile(row).title : row.fileName, fileName: row.fileName, fileSha256: row.fileSha256,
    kind: row.result ? archivedFile(row).kind : "schematic",
    status: row.status, originalStored: row.originalStored, error: row.error, createdAt: row.createdAt.toISOString(),
    path: row.result ? projectFilePath(archivedFile(row)) : null, syncedAt: row.syncedAt?.toISOString() ?? null,
  }));
}
export async function projectFilesForTurn(userId: string, projectId: string, database: Reader = requireDb()) {
  const rows = await database.select({ document: projectDocuments }).from(projectDocuments).innerJoin(projects, eq(projects.id, projectDocuments.projectId))
    .where(and(ownerScope(userId, projectId), eq(projectDocuments.status, "completed"))).orderBy(asc(projectDocuments.id)).limit(PROJECT_DOCUMENT_LIMIT + 1);
  const files = rows.map(({ document }) => archivedFile(document));
  return projectFilesSchema.parse({ revision: hash(JSON.stringify(files.map(file => [file.documentId, file.sha256]))), files });
}
export class ProjectFilesUnavailable extends Error {
  constructor() { super("项目资料已归档，但执行器尚未就绪或不支持资料同步。请管理员更新 Runner 后重试；不会使用空目录继续执行。"); }
}
export function requireProjectFilesRunner(runner?: { capabilities: string[]; status: string; lastHeartbeatAt: Date | null }, files: ProjectFile[] = []) {
  if (!runner?.capabilities.includes(PROJECT_FILES_CAPABILITY) || !["online", "busy"].includes(runner.status) || !runner.lastHeartbeatAt || Date.now() - runner.lastHeartbeatAt.getTime() > 90_000) throw new ProjectFilesUnavailable();
  if (files.some(file => file.kind === "device-report") && !runner.capabilities.includes(DEVICE_REPORT_CAPABILITY)) throw new ProjectFilesUnavailable();
}

export async function archiveDeviceReport(userId: string, projectId: string, input: DeviceReport) {
  if (!db) throw new LlmRequestError("诊断归档需要持久数据库，请管理员配置后重试", 503);
  const report = deviceReportSchema.parse(input);
  const source = JSON.stringify(report); const sha256 = hash(source);
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '3s'`);
    await tx.execute(sql`set local statement_timeout = '5s'`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`archive-id:${report.id}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${projectId}`}))`);
    if (!(await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1))[0]) throw new LlmRequestError("项目不存在或无权访问", 404);
    const existing = (await tx.select().from(projectDocuments).where(eq(projectDocuments.id, report.id)).limit(1))[0];
    if (existing) {
      if (existing.userId !== userId || existing.projectId !== projectId || existing.fileSha256 !== sha256 || existing.mimeType !== "application/vnd.vibehard.device-report+json") throw new LlmRequestError("采集编号冲突，请重新采集", 409);
      return { file: archivedFile(existing), created: false };
    }
    const total = (await tx.select({ n: count() }).from(projectDocuments).where(eq(projectDocuments.projectId, projectId)))[0].n;
    if (total >= PROJECT_DOCUMENT_LIMIT) throw new LlmRequestError(`项目资料达到 ${PROJECT_DOCUMENT_LIMIT} 份上限，无法归档新报告`, 409);
    const receivedAt = new Date().toISOString();
    const captureAge = Date.parse(receivedAt) - Date.parse(report.capturedAt);
    if (captureAge < -300000 || captureAge > 86400000) throw new LlmRequestError("采集时间无效或已超过 24 小时，请重新采集", 400);
    const result = archivedDeviceReportSchema.parse({ type: "device-report", report, receivedAt });
    const row = (await tx.insert(projectDocuments).values({ id: report.id, userId, projectId, fileName: `device-report-${report.id}.json`,
      fileSha256: sha256, mimeType: "application/vnd.vibehard.device-report+json", byteSize: Buffer.byteLength(source),
      objectKey: "", originalStored: false, status: "completed", result }).returning())[0];
    return { file: archivedFile(row), created: true };
  });
}
