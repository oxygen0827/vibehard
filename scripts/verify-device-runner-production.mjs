// One-shot production verification for project routing to the Mac device node.
// It validates real model execution, not physical USB/serial/flashing hardware.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

assert.equal(process.env.ALLOW_DEVICE_RUNNER_VERIFICATION, "20260918-device-runner");
const databaseUrl = new URL(process.env.DATABASE_URL);
assert.ok(!databaseUrl.pathname.includes("preflight"));
const pgEnv = { ...process.env, PGHOST: databaseUrl.hostname, PGPORT: databaseUrl.port || "5432", PGUSER: decodeURIComponent(databaseUrl.username), PGPASSWORD: decodeURIComponent(databaseUrl.password), PGDATABASE: databaseUrl.pathname.slice(1) };
const query = (sql) => spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", env: pgEnv });
const selected = query("select json_build_object('id',id,'email',email,'name',name,'role',role) from users order by created_at limit 1");
assert.equal(selected.status, 0);
const user = JSON.parse(selected.stdout.trim());
const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 15 * 60_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const cookie = `vibehard_session=${payload}.${signature}`;
const base = "http://127.0.0.1:3210/vibehard";
const request = (route, options = {}) => fetch(base + route, { signal: AbortSignal.timeout(30000), ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...options.headers } });
let project;
let verified = false;
try {
  const runners = await request("/api/runners");
  assert.equal(runners.status, 200);
  const nodes = (await runners.json()).runners;
  assert.ok(nodes.some(item => item.runnerKey === "cloud-runner" && item.status === "online"));
  assert.ok(nodes.some(item => item.runnerKey === "device-runner" && item.status === "online" && item.capabilities.includes("usb-device")));
  const projectResponse = await request("/api/projects", { method: "POST", body: JSON.stringify({ name: "Device routing verification 20260918", workspaceKey: `device-${Date.now()}`, model: "gpt-5.6-sol", runnerKey: "device-runner" }) });
  assert.equal(projectResponse.status, 201);
  ({ project } = await projectResponse.json());
  assert.equal(project.runnerKey, "device-runner");
  const threadResponse = await request(`/api/projects/${project.id}/threads`, { method: "POST", body: JSON.stringify({ title: "Device node check" }) });
  assert.equal(threadResponse.status, 201);
  const { thread } = await threadResponse.json();
  const marker = `VIBE_DEVICE_OK_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const turnResponse = await request(`/api/threads/${thread.id}/turns`, { method: "POST", body: JSON.stringify({ input: `Reply with exactly ${marker} and no other text. Do not use tools.`, model: "gpt-5.6-sol", providerId: "tokenadvent" }) });
  assert.equal(turnResponse.status, 202);
  const { turn } = await turnResponse.json();
  let result;
  for (let attempt = 0; attempt < 180; attempt++) {
    const overview = await (await request(`/api/threads/${thread.id}`)).json();
    const current = overview.turns.find(item => item.id === turn.id);
    if (["completed", "failed", "interrupted"].includes(current?.status)) { result = { overview, current }; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(result);
  if (result.current.status !== "completed") throw new Error(result.overview.events.filter(event => event.type === "task.failed" || event.type === "command.output").map(event => event.data.message ?? event.data.text).join(" | ").slice(0, 700));
  const response = result.overview.events.filter(event => event.type.startsWith("agent.message")).map(event => event.data.text ?? "").join("");
  assert.ok(response.includes(marker));
  verified = true;
  console.log(JSON.stringify({ projectId: project.id, turnId: turn.id, runnerKey: project.runnerKey, responseVerified: true, physicalDeviceTested: false }));
} finally {
  if (project) {
    assert.match(project.id, /^[0-9a-f-]{36}$/);
    assert.match(project.workspaceKey, /^[0-9a-f-]{36}\/[0-9a-f-]{36}-device-[0-9]+$/);
    const deleted = query(`delete from projects where id='${project.id}'::uuid and user_id='${user.id}'::uuid returning id`);
    assert.equal(deleted.status, 0);
  }
  if (!verified) process.exitCode = 1;
}
