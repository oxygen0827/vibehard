// Release acceptance creates dedicated member accounts. No board command or existing user impersonation.
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
import { DEVICE_REPORT_CAPABILITY } from "@/lib/agent/project-document";
import type { RuntimeLlm } from "@/lib/agent/llm";
import { sample } from "@/__tests__/fixtures/device-report";

const root = process.env.DEVICE_RELEASE_ROOT ?? "/opt/vibehard/releases/20261001-browser-device-report-v1";
assert.match(root, /^\/opt\/vibehard\/releases\/20261001-browser-device-report(?:-v1|-candidate-v2)$/);
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
  const timer = setTimeout(() => { session.dispose(); done(); }, 120_000);
  try { await session.start(task, config); await ended; } finally { clearTimeout(timer); session.dispose(); }
}
async function main() {
  assert.equal(process.env.ALLOW_DEVICE_REPORT_ACCEPTANCE, "synthetic-two-accounts");
  if (process.argv[2] === "child") return child();
  assert.equal(process.getuid?.(), 0);
  const candidate = process.argv[2] === "candidate";
  assert.ok(candidate || process.argv[2] === "production");
  assert.equal(new URL(process.env.DATABASE_URL!).pathname, candidate ? "/vibehard_device_acceptance_20261001" : "/vibehard");
  const base = candidate ? "http://127.0.0.1:3211/vibehard" : "https://ldcx.tech/vibehard";
  const started = Date.now(); const config = await runtimeLlm("agent"); assert.ok(config);
  const runnerKey = candidate ? "device-report-candidate-20261001" : "cloud-runner";
  const capabilities = ["project-documents-v1", "project-knowledge-v1", "bounded-retrieval-v1", "project-design-files-v1", DEVICE_REPORT_CAPABILITY];
  if (candidate) await registerRunner({ runnerKey, name: "Isolated device report acceptance", capabilities });
  async function account() {
    const password = randomBytes(24).toString("hex");
    const user = await createUser({ email: `device-proof-${randomUUID()}@example.invalid`, passwordHash: await hashPassword(password), inviteCode: "synthetic-release-acceptance", name: "设备报告验收（合成账号）" });
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password }), signal: AbortSignal.timeout(15_000) });
    assert.equal(res.status, 200, "Dedicated member login failed");
    const cookie = res.headers.getSetCookie().find(value => value.startsWith("vibehard_session="))?.split(";")[0]; assert.ok(cookie);
    return { user, cookie };
  }
  const owner = await account(); const outsider = await account();
  async function request(path: string, init: RequestInit = {}, cookie = owner.cookie) {
    return fetch(`${base}${path}`, { ...init, headers: { Cookie: cookie, Origin: new URL(base).origin, ...init.headers }, signal: AbortSignal.timeout(15_000) });
  }
  const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const projectResponse = await request("/api/projects", json({ name: "设备报告实读验收-20261001", workspaceKey: "device-report-proof", runnerKey, model: config.model }));
  assert.equal(projectResponse.status, 201); const { project } = await projectResponse.json();
  // Synthetic protocol report, never presented as a fresh physical device measurement.
  const report = { ...sample, id: randomUUID(), capturedAt: new Date().toISOString(), serial: `proof-${randomUUID().slice(0, 8)}` };
  const archiveUrl = `/api/projects/${project.id}/device-reports`;
  assert.equal((await request(archiveUrl, json(report), "")).status, 401);
  assert.equal((await request(archiveUrl, json(report), outsider.cookie)).status, 404);
  assert.equal((await request(archiveUrl, { ...json(report), headers: { "Content-Type": "application/json", Origin: "https://evil.invalid" } })).status, 403);
  const captureStart = Date.now(); const archived = await request(archiveUrl, json(report));
  assert.equal(archived.status, 201, `Archive failed: ${archived.status}`);
  const { document } = await archived.json(); const archiveMs = Date.now() - captureStart;
  const replay = await request(archiveUrl, json(report)); assert.equal(replay.status, 200); assert.deepEqual((await replay.json()).document, document);
  assert.equal((await request(archiveUrl, json({ ...report, elapsedMs: report.elapsedMs + 1 }))).status, 409);
  const docUrl = `/api/projects/${project.id}/documents/${report.id}`;
  assert.equal((await request(`${docUrl}?format=source`)).status, 409);
  assert.equal((await request(docUrl, {}, outsider.cookie)).status, 404);
  assert.equal((await request(`/api/projects/${project.id}/documents`, {}, outsider.cookie)).status, 404);
  const md = await request(docUrl); assert.equal(md.status, 200); const markdown = await md.text();
  assert.equal(digest(markdown), document.sha256); assert.ok(markdown.includes(report.serial));
  const threadResponse = await request(`/api/projects/${project.id}/threads`, json({ title: "工具实际读取设备报告" })); assert.equal(threadResponse.status, 201);
  const { thread } = await threadResponse.json();
  const taskInput = { input: `请只使用只读 shell 工具 cat ${document.path}，报告其中的采集编号、序列号、服务器接收时间、可用内存、挂载容量和服务状态，并明确这是浏览器上报的历史状态，不证明设备当前在线或真实身份。不能猜测，不修改文件，不执行其他命令或申请审批。`, model: config.model, providerId: "vibehard" };
  if (candidate) {
    await requireDb().update(runnerNodes).set({ capabilities: capabilities.filter(item => item !== DEVICE_REPORT_CAPABILITY), lastHeartbeatAt: new Date() }).where(eq(runnerNodes.runnerKey, runnerKey));
    assert.equal((await request(`/api/threads/${thread.id}/turns`, json(taskInput))).status, 409);
    await requireDb().update(runnerNodes).set({ capabilities, lastHeartbeatAt: new Date() }).where(eq(runnerNodes.runnerKey, runnerKey));
  }
  assert.equal((await request(`/api/threads/${thread.id}/turns`, json(taskInput), outsider.cookie)).status, 403);
  const modelStart = Date.now();
  const turnResponse = await request(`/api/threads/${thread.id}/turns`, json(taskInput)); assert.equal(turnResponse.status, 202); const { turn } = await turnResponse.json();
  if (candidate) {
    const command = (await getQueuedRunnerCommands(runnerKey)).find(command => command.payload.taskId === turn.id); assert.ok(command);
    const task = command.payload as unknown as TaskStart;
    const workspace = `/var/lib/vibehard-runner/workspaces/${project.workspaceKey}`;
    const uid = Number(execFileSync("id", ["-u", "vibehard-runner"])); const gid = Number(execFileSync("id", ["-g", "vibehard-runner"]));
    const parent = workspace.slice(0, workspace.lastIndexOf("/"));
    mkdirSync(parent, { recursive: true, mode: 0o700 }); chownSync(parent, uid, gid); mkdirSync(workspace, { mode: 0o700 }); chownSync(workspace, uid, gid);
    const proc = spawn(process.execPath, [process.argv[1], "child"], { uid, gid, stdio: ["pipe", "pipe", "pipe"], env: {
      PATH: "/opt/vibehard/toolchain/bin:/usr/bin:/bin", HOME: "/var/lib/vibehard-runner", NODE_ENV: "production", ALLOW_DEVICE_REPORT_ACCEPTANCE: "synthetic-two-accounts",
      CODEX_BIN: "/opt/vibehard/toolchain/bin/codex", RUNNER_CODEX_WRAPPER: JSON.stringify(["/opt/vibehard/cloud-runner/codex-sandbox.sh", "{workspace}"]), RUNNER_ENGINEERING_WORKFLOW: "true", CODEX_IDLE_TIMEOUT_MS: "90000",
    } });
    const output: Buffer[] = []; proc.stdout.on("data", chunk => output.push(chunk)); proc.stderr.resume();
    proc.stdin.end(JSON.stringify({ task: { ...task, workspaceKey: workspace }, config }));
    assert.equal(await new Promise(resolve => proc.on("exit", resolve)), 0, "Isolated Agent process failed");
    for (const line of Buffer.concat(output).toString().trim().split("\n")) {
      const event = JSON.parse(line); await ingestRunnerEvent({ ...envelope(), type: "event", runnerKey, taskId: turn.id, threadId: thread.id, ...event });
    }
  }
  let overview;
  for (let i = 0; i < 65; i++) {
    overview = await (await request(`/api/threads/${thread.id}`)).json();
    const state = overview.turns.find((item: { id: string }) => item.id === turn.id)?.status;
    if (["completed", "failed", "interrupted", "waiting_approval"].includes(state)) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(overview.turns.find((item: { id: string }) => item.id === turn.id)?.status, "completed", "Real Agent did not complete");
  const toolRead = overview.events.some((event: AgentEvent) => event.type === "tool.completed" && JSON.stringify(event.data).includes(report.serial) && JSON.stringify(event.data).includes(report.id));
  assert.ok(toolRead, "Tool log must contain exact report identity, not just model output");
  const listing = await (await request(`/api/projects/${project.id}/documents`)).json(); assert.equal(listing.documents.length, 1); assert.ok(listing.documents[0].syncedAt);
  const workspacePath = `/var/lib/vibehard-runner/workspaces/${project.workspaceKey}/${document.path}`;
  assert.equal(digest(readFileSync(workspacePath)), document.sha256);
  if (!candidate) {
    const download = await request(`/api/projects/${project.id}/download`); assert.equal(download.status, 200);
    const zip = unzipSync(new Uint8Array(await download.arrayBuffer()));
    assert.ok(Object.entries(zip).some(([name, value]) => name.endsWith(document.path) && digest(Buffer.from(value)) === document.sha256), "ZIP must contain exact archived report");
  }
  const evidence = { passed: true, mode: candidate ? "candidate" : "production", projectId: project.id, documentId: report.id, turnId: turn.id, markdownSha256: document.sha256,
    archiveMs, modelMs: Date.now() - modelStart, elapsedMs: Date.now() - started, actualToolRead: toolRead, crossAccountDenied: true, sameRequestReplayed: true, syntheticReport: true, boardWrites: false };
  writeFileSync(`${root}/evidence/${candidate ? "candidate" : "production"}-acceptance.json`, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(evidence));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Acceptance failed"); process.exitCode = 1; }).finally(() => closeDb());
