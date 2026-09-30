import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { artifacts, designJobs, projects } from "@/lib/db/schema";
import { designMarkdown } from "@/lib/agent/design-jobs";
import { DESIGN_ARTIFACT_CAPABILITY, designArtifactPath, designArtifactSchema } from "@/lib/agent/design-artifact";
import { publicJob } from "./design-job-store";
import type { DesignJob } from "@/lib/agent/design-jobs";
import type { MaterialLockState } from "./project-material-lock";

type Reader = Pick<ReturnType<typeof requireDb>, "select">;
export class DesignFileUnavailable extends Error {
  constructor() { super("该方案无法同步为项目文件，请先从方案记录下载并联系管理员检查文件大小或格式"); }
}
export class DesignRunnerUnavailable extends Error {
  constructor() { super("项目方案已保存，执行器尚未就绪或需要更新方案文件同步功能，请稍后重试或联系管理员"); }
}
export function requireDesignRunner(runner?: { capabilities: string[]; status: string; lastHeartbeatAt: Date | null }) {
  if (!runner?.capabilities.includes(DESIGN_ARTIFACT_CAPABILITY) || !["online", "busy"].includes(runner.status)
    || !runner.lastHeartbeatAt || Date.now() - runner.lastHeartbeatAt.getTime() > 90000) throw new DesignRunnerUnavailable();
}
function fromRow(job: typeof designJobs.$inferSelect, projectName: string) {
  const markdown = designMarkdown(publicJob(job, projectName));
  const parsed = designArtifactSchema.safeParse({ designId: job.id, projectId: job.projectId, markdown,
    sha256: createHash("sha256").update(markdown).digest("hex") });
  if (!parsed.success) throw new DesignFileUnavailable();
  return parsed.data;
}
const completed = () => and(eq(designJobs.status, "completed"), isNotNull(designJobs.result), eq(designJobs.userId, projects.userId));

export async function latestProjectDesign(userId: string, projectId: string, database: Reader = requireDb()) {
  const row = (await database.select({ job: designJobs, name: projects.name }).from(designJobs)
    .innerJoin(projects, eq(projects.id, designJobs.projectId))
    .where(and(completed(), eq(projects.id, projectId), eq(projects.userId, userId)))
    .orderBy(desc(designJobs.createdAt), desc(designJobs.id)).limit(1))[0];
  return row ? { artifact: fromRow(row.job, row.name), requirement: row.job.requirement, job: publicJob(row.job, row.name) } : null;
}

// Keep the original download immutable. A new turn gets a separately hashed
// view without stale excerpts; existing historical files are not current evidence.
export function designArtifactForTurn(job: DesignJob, state: MaterialLockState) {
  let view = job;
  if (job.result?.materialsLock) {
    // Pre-model citations may precede a revocation during generation. Only the
    // separately checked lock is reusable in the current turn's file view.
    const result = { ...job.result }; delete result.retrieval; delete result.materials;
    if (state !== "active") delete result.materialsLock;
    view = { ...job, result };
  }
  const notice = job.result?.materialsLock && state !== "active" ? `\n\n## 本回合资料有效性\n\n资料锁状态：${state}。历史摘录未下发为本回合证据，须以本回合服务端检索为准；工作区旧方案文件仅作历史记录。\n` : "";
  const markdown = designMarkdown(view) + notice;
  return designArtifactSchema.parse({ projectId: job.projectId, designId: job.id, markdown, sha256: createHash("sha256").update(markdown).digest("hex") });
}

// Only the authenticated cloud Runner pulls its assigned projects. Small pages
// backfill existing designs without copying originals into the web process.
export async function pendingRunnerDesigns(runnerKey: string, after?: string) {
  const rows = await requireDb().select({ job: designJobs, name: projects.name, workspaceKey: projects.workspaceKey }).from(designJobs)
    .innerJoin(projects, eq(projects.id, designJobs.projectId)).leftJoin(artifacts, eq(artifacts.id, designJobs.id))
    .where(and(completed(), eq(projects.runnerKey, runnerKey), isNull(artifacts.id), after ? gt(designJobs.id, after) : undefined))
    .orderBy(asc(designJobs.id)).limit(2);
  const failed: string[] = [];
  const items = rows.flatMap(row => {
    try { return [{ workspaceKey: row.workspaceKey, artifact: fromRow(row.job, row.name) }]; }
    catch { failed.push(row.job.id); return []; }
  });
  return { items, next: rows.at(-1)?.job.id ?? null, failed };
}

export async function acknowledgeRunnerDesign(runnerKey: string, designId: string, sha256: string) {
  return requireDb().transaction(async tx => {
    const row = (await tx.select({ job: designJobs, project: projects }).from(designJobs)
      .innerJoin(projects, eq(projects.id, designJobs.projectId))
      .where(and(completed(), eq(designJobs.id, designId), eq(projects.runnerKey, runnerKey))).limit(1))[0];
    if (!row) return false;
    const artifact = fromRow(row.job, row.project.name);
    if (artifact.sha256 !== sha256) return false;
    // The source design UUID is the idempotency key; there is no Agent turn yet.
    await tx.insert(artifacts).values({ id: designId, projectId: row.project.id, name: "硬件方案", kind: "design", path: designArtifactPath(artifact) })
      .onConflictDoUpdate({ target: artifacts.id, set: { path: designArtifactPath(artifact), updatedAt: new Date() } });
    return true;
  });
}
