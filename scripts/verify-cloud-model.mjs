// Preflight-only real model check. It uses an existing copied user and writes
// only to the isolated migration-test database and cloud Runner workspace.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(databaseUrl.pathname.endsWith("_preflight_20260917"), "Refusing to run outside the isolated preflight database");
assert.ok(process.env.SESSION_SECRET, "SESSION_SECRET is required");
const pg = spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-c", "select json_build_object('id',id,'email',email,'name',name,'role',role) from users order by created_at limit 1"], {
  encoding: "utf8", env: { ...process.env, PGHOST: databaseUrl.hostname, PGPORT: databaseUrl.port || "5432", PGUSER: decodeURIComponent(databaseUrl.username), PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: databaseUrl.pathname.slice(1) },
});
assert.equal(pg.status, 0, "Failed to select preflight user");
const user = JSON.parse(pg.stdout.trim());
const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 15 * 60_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const cookie = `vibehard_session=${payload}.${signature}`;
const base = "http://127.0.0.1:3211/vibehard";
const request = (route, options = {}) => fetch(base + route, { signal: AbortSignal.timeout(20000), ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...options.headers } });
const nonce = `CLOUD_MODEL_OK_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

const modelsResponse = await request("/api/models");
assert.equal(modelsResponse.status, 200);
const models = (await modelsResponse.json()).models;
assert.ok(models.some(item => item.providerId === "tokenadvent" && item.model === "gpt-5.6-sol"), "Configured cloud model is missing");
const projectResponse = await request("/api/projects", { method: "POST", body: JSON.stringify({ name: "Real cloud model preflight", workspaceKey: `real-${Date.now()}`, model: "gpt-5.6-sol" }) });
assert.equal(projectResponse.status, 201);
const { project } = await projectResponse.json();
assert.equal(project.runnerKey, "cloud-runner");
const threadResponse = await request(`/api/projects/${project.id}/threads`, { method: "POST", body: JSON.stringify({ title: "Real model check" }) });
assert.equal(threadResponse.status, 201);
const { thread } = await threadResponse.json();
const turnResponse = await request(`/api/threads/${thread.id}/turns`, { method: "POST", body: JSON.stringify({ input: `Reply with exactly ${nonce} and no other text.`, model: "gpt-5.6-sol", providerId: "tokenadvent" }) });
assert.equal(turnResponse.status, 202);
const { turn } = await turnResponse.json();

let result;
for (let attempt = 0; attempt < 180; attempt++) {
  const overviewResponse = await request(`/api/threads/${thread.id}`);
  assert.equal(overviewResponse.status, 200);
  const overview = await overviewResponse.json();
  const current = overview.turns.find(item => item.id === turn.id);
  if (["completed", "failed", "interrupted"].includes(current?.status)) { result = { overview, current }; break; }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(result, "Real cloud model turn timed out");
if (result.current.status !== "completed") {
  const failures = result.overview.events.filter(event => event.type === "task.failed" || event.type === "command.output").map(event => event.data.message ?? event.data.text).filter(Boolean);
  throw new Error(`Real cloud model turn ${result.current.status}: ${failures.join(" | ").slice(0, 500)}`);
}
const responseText = result.overview.events.filter(event => event.type === "agent.message" || event.type === "agent.message.delta").map(event => event.data.text ?? "").join("");
assert.ok(responseText.includes(nonce), "Real model response did not contain the requested nonce");
console.log(JSON.stringify({ provider: "tokenadvent", model: "gpt-5.6-sol", projectId: project.id, turnId: turn.id, status: result.current.status, responseVerified: true }));
