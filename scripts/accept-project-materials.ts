// Release proof: fresh member accounts, one real design and one read-only Agent turn per environment.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, chownSync, readFileSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { unzipSync } from "fflate";
import { requireDb, closeDb } from "@/lib/db";
import { runnerNodes } from "@/lib/db/schema";
import { createUser, registerRunner, getQueuedRunnerCommands, ingestRunnerEvent } from "@/lib/server/store";
import { hashPassword } from "@/lib/server/security";
import { runtimeLlm } from "@/lib/server/llm-settings";
import { CodexSession } from "@/runner/codex-stdio";
import { envelope, type TaskStart, type AgentEvent } from "@/lib/agent/protocol";
import type { RuntimeLlm } from "@/lib/agent/llm";
import { DatabaseSync } from "node:sqlite";
import { checkDesignMaterials } from "@/lib/agent/design-materials";

const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
async function child() {
  assert.notEqual(process.getuid?.(), 0);
  const chunks: Buffer[] = []; for await (const value of process.stdin) chunks.push(Buffer.from(value));
  const { task, config } = JSON.parse(Buffer.concat(chunks).toString()) as { task: TaskStart; config: RuntimeLlm };
  let done = () => {}; const ended = new Promise<void>(resolve => { done = resolve; });
  const session = new CodexSession((event, codexThreadId) => {
    process.stdout.write(JSON.stringify({ event, codexThreadId }) + "\n");
    if (event.type === "approval.requested") session.resolveApproval(String(event.data.approvalId), "reject");
    if (["task.completed", "task.failed", "task.interrupted"].includes(event.type)) done();
  }, "/var/lib/vibehard-runner/workspaces");
  const timer = setTimeout(() => { session.dispose(); done(); }, 180_000);
  try { await session.start(task, config); await ended; } finally { clearTimeout(timer); session.dispose(); }
}
async function main() {
  assert.equal(process.env.ALLOW_PROJECT_MATERIALS_ACCEPTANCE, "synthetic-two-accounts");
  if (process.argv[2] === "child") return child();
  assert.equal(process.getuid?.(), 0);
  const candidate = process.argv[2] === "candidate";
  assert.ok(candidate || process.argv[2] === "production");
  const release = "20260930-project-materials-v1";
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, candidate ? "/vibehard_materials_acceptance_20260930" : "/vibehard");
  const base = candidate ? "http://127.0.0.1:3211/vibehard" : "https://ldcx.tech/vibehard";
  const started = Date.now(); const config = await runtimeLlm("agent"); assert.ok(config);
  const runnerKey = candidate ? "materials-candidate-20260930" : "cloud-runner";
  const capabilities = ["project-documents-v1", "project-knowledge-v1", "bounded-retrieval-v1", "project-design-files-v1"];
  if (candidate) await registerRunner({ runnerKey, name: "Isolated archive acceptance", capabilities });
  async function account() {
    const password = randomBytes(24).toString("hex");
    const user = await createUser({ email: `materials-proof-${randomUUID()}@example.invalid`, passwordHash: await hashPassword(password), inviteCode: "synthetic-release-acceptance", name: "项目归档验收（合成账号）" });
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password }), signal: AbortSignal.timeout(15_000) });
    assert.equal(res.status, 200, "Dedicated member login failed");
    const cookie = res.headers.getSetCookie().find(value => value.startsWith("vibehard_session="))?.split(";")[0]; assert.ok(cookie);
    return { user, cookie };
  }
  const owner = await account(); const outsider = await account();
  async function request(path: string, init: RequestInit = {}, cookie = owner.cookie) {
    return fetch(`${base}${path}`, { ...init, headers: { Cookie: cookie, ...init.headers }, signal: AbortSignal.timeout(150_000) });
  }
  const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const projectResponse = await request("/api/projects", json({ name: "资料包与项目工作流验收-20260930", workspaceKey: "materials-proof", runnerKey, model: config.model }));
  assert.equal(projectResponse.status, 201); const { project } = await projectResponse.json();
    const response = await request("/api/design", json({ projectId: project.id, requestId: randomUUID(), requirement: "ESP32-S3-Touch-LCD-2.8C USB 供电触摸屏演示，参考原理图，用简短方案列出 BOM、接口与风险，不添加电池，主板 BOM 使用完整单一型号 ESP32-S3-Touch-LCD-2.8C。" }));
    assert.equal(response.status, 202); let { job } = await response.json();
    for (let i = 0; i < 55 && ["queued", "running"].includes(job.status); i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); job = (await (await request(`/api/design/${job.id}`)).json()).job;
    }
    assert.equal(job.status, "completed", `Design failed: ${job.diagnostics?.errorCode ?? "unknown"}`);
    assert.ok(job.diagnostics.totalMs < 90_000); assert.equal(job.result.retrieval.status, "matched");
    assert.ok(job.result.retrieval.references.length > 0);
    const index = new DatabaseSync("/opt/vibehard/knowledge/20260926-esp32-s3-v1/knowledge-fts.sqlite", { readOnly: true });
    try { for (const ref of job.result.retrieval.references) {
      assert.equal(ref.reviewStatus, "auto-indexed"); const position = /#page=(\d+)&part=(\d+)$/.exec(ref.source); assert.ok(position);
      const chunk = index.prepare("select text from chunks where source_sha=? and page=? and part=?").get(ref.sha256, Number(position[1]), Number(position[2])) as { text: string };
      assert.ok(chunk?.text.includes(ref.excerpt));
    } } finally { index.close(); }
    assert.equal((await request(`/api/design/${job.id}`, {}, outsider.cookie)).status, 404);
    assert.equal((await request(`/api/projects/${project.id}/bom`)).status, 200);
    assert.equal((await request(`/api/projects/${project.id}/bom`, {}, outsider.cookie)).status, 404);
    const designEvidence = { jobId: job.id, elapsedMs: job.diagnostics.totalMs, references: job.result.retrieval.references.length, hashesAndPositionsVerified: true, crossAccountDenied: true };
  assert.equal(job.result.materials.version, "generation-evidence-v1");
  assert.equal(job.result.materials.items.length, job.result.bom.length);
  assert.deepEqual(job.result.materials, checkDesignMaterials(job.result.bom, job.result.retrieval, new Date(job.result.materials.checkedAt)));
  const materialUrl = `/api/design/${job.id}/materials`;
  assert.equal((await fetch(base + materialUrl)).status, 401);
  assert.equal((await request(materialUrl, {}, outsider.cookie)).status, 404);
  const archive = await request(materialUrl); assert.equal(archive.status, 200);
  assert.equal(archive.headers.get("cache-control"), "private, no-store");
  const archiveBytes = new Uint8Array(await archive.arrayBuffer());
  const zip = unzipSync(archiveBytes);
  const manifest = JSON.parse(Buffer.from(zip["manifest.json"]).toString());
  assert.equal(manifest.projectId, project.id); assert.equal(manifest.designId, job.id);
  for (const file of manifest.files) {
    assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
    assert.equal(zip[file.path].length, file.bytes); assert.equal(digest(Buffer.from(zip[file.path])), file.sha256);
  }
  for (let i=0;i<manifest.references.length;i++) {
    assert.equal(manifest.references[i].sourceSha256, job.result.retrieval.references[i].sha256);
    assert.ok(Buffer.from(zip[manifest.references[i].file]).toString().includes("未人工复核"));
  }
  const repeat = await request(materialUrl); assert.equal(repeat.status, 200);
  assert.equal(digest(Buffer.from(await repeat.arrayBuffer())), digest(Buffer.from(archiveBytes)));
  const md = await request(`/api/design/${job.id}/download`); assert.equal(md.status, 200);
  const markdown = await md.text(); assert.equal(Buffer.from(zip["designs/design.md"]).toString(), markdown);
  const sha = digest(markdown); const archivePath = `designs/方案-${job.id}-${sha.slice(0,16)}.md`;
  const marker = "generation-evidence-v1";
  assert.ok(markdown.includes(marker)); assert.ok(Buffer.from(zip["materials/check.md"]).toString().includes(marker));
  for (const page of ["debug","embedded"]) {
    const pageResponse = await request(`/app/${page}?project=${project.id}`);
    assert.equal(pageResponse.status,200); assert.ok((await pageResponse.text()).includes("self.__next_f"));
  }
  const threadResponse = await request(`/api/projects/${project.id}/threads`, json({ title: "实际读取方案配套报告" })); assert.equal(threadResponse.status, 201);
  const { thread } = await threadResponse.json();
  const taskInput = { input: `请实际使用只读 shell 工具 cat "${archivePath}"，报告文件中检查规则的版本字符串及一个来源 SHA256，并说明未人工复核和仅本次检索证据的边界。不能猜测，不修改任何文件，不操作设备，不申请审批。`, model: config.model, providerId: "vibehard" };
  if (candidate) {
    await requireDb().update(runnerNodes).set({ capabilities: [], lastHeartbeatAt: new Date() }).where(eq(runnerNodes.runnerKey, runnerKey));
    assert.equal((await request(`/api/threads/${thread.id}/turns`, json(taskInput))).status, 409);
    await requireDb().update(runnerNodes).set({ capabilities, lastHeartbeatAt: new Date() }).where(eq(runnerNodes.runnerKey, runnerKey));
  }
  assert.equal((await request(`/api/threads/${thread.id}/turns`, json(taskInput), outsider.cookie)).status, 403);
  const turnResponse = await request(`/api/threads/${thread.id}/turns`, json(taskInput)); assert.equal(turnResponse.status, 202); const { turn } = await turnResponse.json();
  if (candidate) {
    const command = (await getQueuedRunnerCommands(runnerKey)).find(command => command.payload.taskId === turn.id); assert.ok(command);
    const task = command.payload as unknown as TaskStart;
    const workspace = `/var/lib/vibehard-runner/workspaces/${project.workspaceKey}`;
    const uid = Number(execFileSync("id", ["-u", "vibehard-runner"])); const gid = Number(execFileSync("id", ["-g", "vibehard-runner"]));
    const parent = workspace.slice(0, workspace.lastIndexOf("/"));
    mkdirSync(parent, { recursive: true, mode: 0o700 }); chownSync(parent, uid, gid); mkdirSync(workspace, { mode: 0o700 }); chownSync(workspace, uid, gid);
    const proc = spawn(process.execPath, [process.argv[1], "child"], { uid, gid, stdio: ["pipe", "pipe", "pipe"], env: {
      PATH: "/opt/vibehard/toolchain/bin:/usr/bin:/bin", HOME: "/var/lib/vibehard-runner", NODE_ENV: "production", ALLOW_PROJECT_MATERIALS_ACCEPTANCE: "synthetic-two-accounts",
      CODEX_BIN: "/opt/vibehard/toolchain/bin/codex", RUNNER_CODEX_WRAPPER: JSON.stringify(["/opt/vibehard/cloud-runner/codex-sandbox.sh", "{workspace}"]), RUNNER_ENGINEERING_WORKFLOW: "true", CODEX_IDLE_TIMEOUT_MS: "120000",
    } });
    const output: Buffer[] = []; proc.stdout.on("data", chunk => output.push(chunk)); proc.stderr.resume();
    proc.stdin.end(JSON.stringify({ task: { ...task, workspaceKey: workspace }, config }));
    assert.equal(await new Promise(resolve => proc.on("exit", resolve)), 0, "Isolated Agent process failed");
    for (const line of Buffer.concat(output).toString().trim().split("\n")) {
      const event = JSON.parse(line); await ingestRunnerEvent({ ...envelope(), type: "event", runnerKey, taskId: turn.id, threadId: thread.id, ...event });
    }
  }
  let overview;
  for (let i = 0; i < 100; i++) {
    overview = await (await request(`/api/threads/${thread.id}`)).json();
    const state = overview.turns.find((item: { id: string }) => item.id === turn.id)?.status;
    if (["completed", "failed", "interrupted", "waiting_approval"].includes(state)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(overview.turns.find((item: { id: string }) => item.id === turn.id)?.status, "completed", "Real Agent did not complete");
  const toolRead = overview.events.some((event: AgentEvent) => {
    const item = event.data.item as { type?: string; exitCode?: number } | undefined;
    return event.type === "tool.completed" && item?.type === "commandExecution" && item.exitCode === 0 && JSON.stringify(event.data).includes(marker);
  });
  assert.ok(toolRead, "Tool log must contain the file marker, not just model output");
  const workspacePath = `/var/lib/vibehard-runner/workspaces/${project.workspaceKey}/${archivePath}`;
  assert.equal(digest(readFileSync(workspacePath)), sha);
  if (!candidate) {
    const download = await request(`/api/projects/${project.id}/download`); assert.equal(download.status, 200);
    const workspaceZip = unzipSync(new Uint8Array(await download.arrayBuffer()));
    assert.ok(Object.entries(workspaceZip).some(([name,value]) => name.endsWith(archivePath) && digest(Buffer.from(value)) === sha));
  }
  const report = { passed: true, mode: candidate ? "candidate" : "production", projectId: project.id, turnId: turn.id,
    elapsedMs: Date.now()-started, actualToolRead: toolRead, materialPackageSha256: digest(Buffer.from(archiveBytes)),
    files: Object.keys(zip).length, markdownSha256: sha, crossAccountDenied: true, manualReview: false, design: designEvidence,
    statuses: job.result.materials.items.map((item: {status:string})=>item.status), syntheticRecordsRetained: true, hardwareOperated: false };
  writeFileSync(`/opt/vibehard/releases/${release}/evidence/${candidate ? "candidate" : "production"}-acceptance.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Acceptance failed"); process.exitCode = 1; }).finally(() => closeDb());
