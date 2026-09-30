// Explicit release acceptance: fresh member accounts + synthetic PDF only. Never impersonates an existing user.
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

const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
function pdf(marker: string) {
  const drawing = `BT /F1 12 Tf 40 750 Td (SYNTHETIC ${marker}) Tj ET\nBT /F1 12 Tf 40 715 Td (VIN 3.3V -> R7 1000 ohm -> D2 LED -> GND) Tj ET\nBT /F1 12 Tf 40 690 Td (No MCU. One page. Test only, not hardware verified.) Tj ET\n40 600 m 140 600 l S 140 590 70 20 re S 210 600 m 300 600 l S\nBT /F1 12 Tf 140 630 Td (R7 1k) Tj ET\nBT /F1 12 Tf 300 630 Td (D2 LED) Tj ET`;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(drawing)} >>\nstream\n${drawing}\nendstream`];
  let text = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(text);
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(text);
}
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
  assert.equal(process.env.ALLOW_PROJECT_ARCHIVE_ACCEPTANCE, "synthetic-two-accounts");
  if (process.argv[2] === "child") return child();
  assert.equal(process.getuid?.(), 0);
  const candidate = process.argv[2] === "candidate";
  assert.ok(candidate || process.argv[2] === "production");
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, candidate ? "/vibehard_archive_acceptance_20260930" : "/vibehard");
  const base = candidate ? "http://127.0.0.1:3211/vibehard" : "https://ldcx.tech/vibehard";
  const started = Date.now(); const config = await runtimeLlm("agent"); assert.ok(config);
  const runnerKey = candidate ? "archive-candidate-20260930" : "cloud-runner";
  const capabilities = ["project-documents-v1", "project-knowledge-v1", "bounded-retrieval-v1", "project-design-files-v1"];
  if (candidate) await registerRunner({ runnerKey, name: "Isolated archive acceptance", capabilities });
  async function account() {
    const password = randomBytes(24).toString("hex");
    const user = await createUser({ email: `archive-proof-${randomUUID()}@example.invalid`, passwordHash: await hashPassword(password), inviteCode: "synthetic-release-acceptance", name: "项目归档验收（合成账号）" });
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
  const projectResponse = await request("/api/projects", json({ name: "原理图归档真实验收-20260930", workspaceKey: "archive-proof", runnerKey, model: config.model }));
  assert.equal(projectResponse.status, 201); const { project } = await projectResponse.json();
  const marker = `ARCHIVE-${randomUUID().slice(0, 8)}`; const bytes = pdf(marker); const requestId = randomUUID();
  function form() { const data = new FormData(); data.set("projectId", project.id); data.set("requestId", requestId); data.set("file", new File([new Uint8Array(bytes)], "synthetic-archive.pdf", { type: "application/pdf" })); return data; }
  assert.equal((await request("/api/schematic", { method: "POST", body: form() }, outsider.cookie)).status, 404);
  const visionStart = Date.now(); const response = await request("/api/schematic", { method: "POST", body: form() }); assert.equal(response.status, 200);
  const events = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
  const error = events.find(event => event.type === "error"); assert.ok(!error, error?.error);
  const result = events.find(event => event.type === "result")?.result; assert.equal(result?.archive?.projectId, project.id);
  assert.equal(result.fileSha256, digest(bytes)); assert.ok(result.draft.content.includes(marker), "Vision must read synthetic marker");
  assert.ok(result.draft.content.includes("R7") && result.draft.content.includes("D2"));
  const visionMs = Date.now() - visionStart;
  const docUrl = `/api/projects/${project.id}/documents/${requestId}`;
  const original = await request(`${docUrl}?format=source`); assert.equal(original.status, 200);
  assert.equal(digest(Buffer.from(await original.arrayBuffer())), digest(bytes));
  const md = await request(docUrl); assert.equal(md.status, 200); const markdown = await md.text(); assert.ok(markdown.includes(marker));
  for (const suffix of ["", "?format=source"]) assert.equal((await request(docUrl + suffix, {}, outsider.cookie)).status, 404);
  assert.equal((await request(`/api/projects/${project.id}/documents`, {}, outsider.cookie)).status, 404);
  const replay = await request("/api/schematic", { method: "POST", body: form() });
  const replayEvents = (await replay.text()).trim().split("\n").map(line => JSON.parse(line));
  assert.equal(replayEvents.length, 1); assert.deepEqual(replayEvents[0].result, result);
  const threadResponse = await request(`/api/projects/${project.id}/threads`, json({ title: "实际读取归档文档" })); assert.equal(threadResponse.status, 201);
  const { thread } = await threadResponse.json();
  const taskInput = { input: `请实际使用只读 shell 工具 cat ${result.archive.path}，逐字报告文件内以 ARCHIVE- 开头的校验标识及 R7/D2 信息，并说明“未人工复核”。不能猜测，不修改任何文件，不要执行其他命令或申请审批。`, model: config.model, providerId: "vibehard" };
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
      PATH: "/opt/vibehard/toolchain/bin:/usr/bin:/bin", HOME: "/var/lib/vibehard-runner", NODE_ENV: "production", ALLOW_PROJECT_ARCHIVE_ACCEPTANCE: "synthetic-two-accounts",
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
  const toolRead = overview.events.some((event: AgentEvent) => event.type === "tool.completed" && JSON.stringify(event.data).includes(marker));
  assert.ok(toolRead, "Tool log must contain the file marker, not just model output");
  const listing = await (await request(`/api/projects/${project.id}/documents`)).json(); assert.ok(listing.documents[0].syncedAt);
  const workspacePath = `/var/lib/vibehard-runner/workspaces/${project.workspaceKey}/${result.archive.path}`;
  assert.equal(digest(readFileSync(workspacePath)), digest(markdown));
  if (!candidate) {
    const download = await request(`/api/projects/${project.id}/download`); assert.equal(download.status, 200);
    const zip = unzipSync(new Uint8Array(await download.arrayBuffer()));
    assert.ok(Object.entries(zip).some(([name, value]) => name.endsWith(result.archive.path) && digest(Buffer.from(value)) === digest(markdown)), "ZIP must contain exact archived Markdown");
  }
  const report = { passed: true, mode: candidate ? "candidate" : "production", projectId: project.id, documentId: requestId, turnId: turn.id, sourceSha256: digest(bytes), markdownSha256: digest(markdown), visionMs, elapsedMs: Date.now() - started, actualToolRead: toolRead, sourceDownloadVerified: true, crossAccountDenied: true, sameRequestReplayed: true, manualReview: false };
  writeFileSync(`/opt/vibehard/releases/20260930-project-archive-v1/evidence/${candidate ? "candidate" : "production"}-acceptance.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Acceptance failed"); process.exitCode = 1; }).finally(() => closeDb());
