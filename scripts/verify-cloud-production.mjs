// One-shot production verification for the 2026-09-18 cloud Runner release.
// Creates an exact test project under the existing account, exercises the real
// model/build/download path, then removes only that DB project and archives its
// generated workspace under the release directory for audit evidence.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

assert.equal(process.env.ALLOW_PRODUCTION_VERIFICATION, "20260918-cloud-runner");
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(!databaseUrl.pathname.includes("preflight"), "Expected the production database");
assert.ok(process.env.SESSION_SECRET);
const pgEnv = { ...process.env, PGHOST: databaseUrl.hostname, PGPORT: databaseUrl.port || "5432", PGUSER: decodeURIComponent(databaseUrl.username), PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: databaseUrl.pathname.slice(1) };
const query = (sql) => spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", env: pgEnv });
const selected = query("select json_build_object('id',id,'email',email,'name',name,'role',role) from users order by created_at limit 1");
assert.equal(selected.status, 0);
const user = JSON.parse(selected.stdout.trim());
const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 20 * 60_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const cookie = `vibehard_session=${payload}.${signature}`;
const base = "http://127.0.0.1:3210/vibehard";
const request = (route, options = {}) => fetch(base + route, { signal: AbortSignal.timeout(30000), ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...options.headers } });
const release = "/opt/vibehard/releases/20260918-cloud-runner";
let project;
let verified = false;

try {
  const modelsResponse = await request("/api/models");
  assert.equal(modelsResponse.status, 200);
  const models = (await modelsResponse.json()).models;
  assert.ok(models.some(item => item.providerId === "tokenadvent" && item.model === "gpt-5.6-sol"));
  const projectResponse = await request("/api/projects", { method: "POST", body: JSON.stringify({ name: "Deployment verification 20260918", workspaceKey: `verify-${Date.now()}`, model: "gpt-5.6-sol" }) });
  assert.equal(projectResponse.status, 201);
  ({ project } = await projectResponse.json());
  assert.equal(project.runnerKey, "cloud-runner");
  const threadResponse = await request(`/api/projects/${project.id}/threads`, { method: "POST", body: JSON.stringify({ title: "Production cloud build verification" }) });
  assert.equal(threadResponse.status, 201);
  const { thread } = await threadResponse.json();
  const marker = `VIBE_PRODUCTION_OK_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const input = `Create main.c that prints exactly ${marker}. Create a Makefile that builds build/demo_app with gcc. Run make and ./build/demo_app. Do not use the network or paths outside this workspace. Finish with a short build result.`;
  const turnResponse = await request(`/api/threads/${thread.id}/turns`, { method: "POST", body: JSON.stringify({ input, model: "gpt-5.6-sol", providerId: "tokenadvent" }) });
  assert.equal(turnResponse.status, 202);
  const { turn } = await turnResponse.json();
  const approved = new Set();
  let result;
  for (let attempt = 0; attempt < 300; attempt++) {
    const overviewResponse = await request(`/api/threads/${thread.id}`);
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    for (const approval of overview.approvals.filter(item => item.status === "pending")) {
      if (approved.has(approval.id)) continue;
      assert.equal(approval.turnId, turn.id);
      assert.ok(["command", "write"].includes(approval.risk));
      const decision = await request(`/api/approvals/${approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "approve" }) });
      assert.equal(decision.status, 200);
      approved.add(approval.id);
    }
    const current = overview.turns.find(item => item.id === turn.id);
    if (["completed", "failed", "interrupted"].includes(current?.status)) { result = { overview, current }; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(result, "Production task timed out");
  if (result.current.status !== "completed") {
    const errors = result.overview.events.filter(event => event.type === "task.failed" || event.type === "command.output").map(event => event.data.message ?? event.data.text).filter(Boolean);
    throw new Error(errors.join(" | ").slice(0, 700));
  }
  const output = result.overview.events.filter(event => event.type === "command.output" || event.type.startsWith("agent.message")).map(event => event.data.text ?? "").join("");
  assert.ok(output.includes(marker));
  const download = await request(`/api/projects/${project.id}/download`);
  assert.equal(download.status, 200);
  const temporary = await mkdir(path.join(os.tmpdir(), `vibehard-${project.id}`), { recursive: true }).then(() => path.join(os.tmpdir(), `vibehard-${project.id}`));
  try {
    const archive = path.join(temporary, "project.zip");
    await writeFile(archive, new Uint8Array(await download.arrayBuffer()));
    const extract = spawnSync("/usr/bin/unzip", ["-q", archive, "-d", temporary], { encoding: "utf8" });
    assert.equal(extract.status, 0);
    assert.ok((await readFile(path.join(temporary, "main.c"), "utf8")).includes(marker));
    assert.equal((await readFile(path.join(temporary, "build", "demo_app"))).subarray(0, 4).toString("hex"), "7f454c46");
  } finally { await rm(temporary, { recursive: true, force: true }); }
  verified = true;
  console.log(JSON.stringify({ projectId: project.id, turnId: turn.id, provider: "tokenadvent", model: "gpt-5.6-sol", approvals: approved.size, modelResponse: true, compiledOutput: true, zipDownload: true }));
} finally {
  if (project) {
    assert.match(project.id, /^[0-9a-f-]{36}$/);
    assert.match(project.workspaceKey, /^[0-9a-f-]{36}\/[0-9a-f-]{36}-verify-[0-9]+$/);
    const deleted = query(`delete from projects where id='${project.id}'::uuid and user_id='${user.id}'::uuid returning id`);
    assert.equal(deleted.status, 0);
    const evidenceRoot = path.join(release, "verification-workspaces");
    await mkdir(evidenceRoot, { recursive: true, mode: 0o700 });
    for (const [sourceRoot, suffix] of [["/var/lib/vibehard-runner/workspaces", "workspace"], ["/var/lib/vibehard-runner/codex", "codex"]]) {
      const source = path.join(sourceRoot, project.workspaceKey);
      if (existsSync(source)) await rename(source, path.join(evidenceRoot, `${project.id}-${suffix}`));
    }
  }
  if (!verified) process.exitCode = 1;
}
