// Preflight-only end-to-end check using the real model and isolated Runner.
// It auto-approves operations only for the project created by this script in
// the dedicated migration-test database.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(databaseUrl.pathname.endsWith("_preflight_20260917"), "Refusing to run outside the isolated preflight database");
assert.ok(process.env.SESSION_SECRET, "SESSION_SECRET is required");
const pg = spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-c", "select json_build_object('id',id,'email',email,'name',name,'role',role) from users order by created_at limit 1"], {
  encoding: "utf8", env: { ...process.env, PGHOST: databaseUrl.hostname, PGPORT: databaseUrl.port || "5432", PGUSER: decodeURIComponent(databaseUrl.username), PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: databaseUrl.pathname.slice(1) },
});
assert.equal(pg.status, 0, "Failed to select preflight user");
const user = JSON.parse(pg.stdout.trim());
const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 20 * 60_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const cookie = `vibehard_session=${payload}.${signature}`;
const base = "http://127.0.0.1:3211/vibehard";
const request = (route, options = {}) => fetch(base + route, { signal: AbortSignal.timeout(30000), ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...options.headers } });

const projectResponse = await request("/api/projects", { method: "POST", body: JSON.stringify({ name: "Real cloud build preflight", workspaceKey: `build-${Date.now()}`, model: "gpt-5.6-sol" }) });
assert.equal(projectResponse.status, 201);
const { project } = await projectResponse.json();
assert.equal(project.runnerKey, "cloud-runner");
const threadResponse = await request(`/api/projects/${project.id}/threads`, { method: "POST", body: JSON.stringify({ title: "Real build check" }) });
assert.equal(threadResponse.status, 201);
const { thread } = await threadResponse.json();
const marker = `VIBE_CLOUD_BUILD_OK_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
const prompt = [
  "Create a minimal native C project in this workspace.",
  "Create main.c that prints exactly " + marker + ".",
  "Create a Makefile whose default target builds build/demo_app with gcc.",
  "Run make and then run ./build/demo_app to verify it.",
  "Do not access the network or any path outside this workspace.",
  "Finish by briefly stating that the build passed.",
].join(" ");
const turnResponse = await request(`/api/threads/${thread.id}/turns`, { method: "POST", body: JSON.stringify({ input: prompt, model: "gpt-5.6-sol", providerId: "tokenadvent" }) });
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
    assert.equal(approval.turnId, turn.id, "Refusing to approve another turn");
    assert.ok(["command", "write"].includes(approval.risk), "Unexpected approval risk");
    const decision = await request(`/api/approvals/${approval.id}/decision`, { method: "POST", body: JSON.stringify({ decision: "approve" }) });
    assert.equal(decision.status, 200);
    approved.add(approval.id);
  }
  const current = overview.turns.find(item => item.id === turn.id);
  if (["completed", "failed", "interrupted"].includes(current?.status)) { result = { overview, current }; break; }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(result, "Real cloud build turn timed out");
if (result.current.status !== "completed") {
  const failures = result.overview.events.filter(event => event.type === "task.failed" || event.type === "command.output").map(event => event.data.message ?? event.data.text).filter(Boolean);
  throw new Error(`Real cloud build turn ${result.current.status}: ${failures.join(" | ").slice(0, 700)}`);
}
const outputs = result.overview.events.filter(event => event.type === "command.output" || event.type === "agent.message" || event.type === "agent.message.delta").map(event => event.data.text ?? "").join("");
assert.ok(outputs.includes(marker), "Compiled executable output marker was not returned");

const download = await request(`/api/projects/${project.id}/download`);
assert.equal(download.status, 200);
const directory = await mkdtemp(path.join(os.tmpdir(), "vibehard-real-build-"));
try {
  const archive = path.join(directory, "project.zip");
  await writeFile(archive, new Uint8Array(await download.arrayBuffer()));
  const listing = spawnSync("/usr/bin/unzip", ["-Z1", archive], { encoding: "utf8" });
  assert.equal(listing.status, 0);
  const files = listing.stdout.trim().split("\n");
  assert.ok(files.includes("main.c"));
  assert.ok(files.includes("Makefile"));
  assert.ok(files.includes("build/demo_app"));
  const extracted = spawnSync("/usr/bin/unzip", ["-q", archive, "-d", directory], { encoding: "utf8" });
  assert.equal(extracted.status, 0);
  assert.ok((await readFile(path.join(directory, "main.c"), "utf8")).includes(marker));
  const binary = await readFile(path.join(directory, "build", "demo_app"));
  assert.equal(binary.subarray(0, 4).toString("hex"), "7f454c46", "Expected a Linux ELF build artifact");
  console.log(JSON.stringify({ provider: "tokenadvent", model: "gpt-5.6-sol", projectId: project.id, turnId: turn.id, approvals: approved.size, status: result.current.status, compiledOutputVerified: true, zipDownloadVerified: true, files: files.length }));
} finally { await rm(directory, { recursive: true, force: true }); }
