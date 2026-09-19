import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2];
assert.match(base ?? "", /^http:\/\/127\.0\.0\.1:321[01]\/vibehard$/);
const live = process.argv.includes("--live");
const u = new URL(process.env.DATABASE_URL);
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) };
const query = (sql) => { const result = spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" }); assert.equal(result.status, 0, "Verification database query failed"); return result.stdout.trim(); };
const adminId = randomUUID();
const admin = { id: adminId, email: `llm-admin-check-${adminId}@example.invalid`, name: "LLM verification", role: "admin" };
const token = (user) => { const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 600_000 })).toString("base64url"); return `vibehard_session=${payload}.${createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url")}`; };
const cookie = token(admin);
const request = (route, options = {}) => fetch(base + route, { signal: AbortSignal.timeout(105_000), ...options, headers: { Cookie: cookie, "Content-Type": "application/json", ...options.headers } });
const memberId = randomUUID();
const member = { id: memberId, email: `llm-check-${memberId}@example.invalid`, name: "LLM verification", role: "member" };
let project;
const report = { platform: false, settings: false, credentialsHidden: false, permissionChecks: false, live: {} };
try {
  query(`insert into users (id,email,password_hash,name,role) values ('${adminId}','${admin.email}','unused-test-hash','LLM verification','admin')`);
  query(`insert into users (id,email,password_hash,name,role) values ('${memberId}','${member.email}','unused-test-hash','LLM verification','member')`);
  assert.equal((await request("/api/admin/llm", { headers: { Cookie: "" } })).status, 401);
  assert.equal((await request("/api/admin/llm", { headers: { Cookie: token(member) } })).status, 403);
  assert.equal((await request("/api/admin/llm", { method: "PUT", headers: { Cookie: token(member) }, body: "{}" })).status, 403);
  assert.equal((await request("/api/runners/model-config?taskId=" + randomUUID())).status, 403);
  report.permissionChecks = true;
  const response = await request("/api/admin/llm"); assert.equal(response.status, 200);
  const { settings } = await response.json(); assert.equal(settings.length, 2);
  for (const setting of settings) {
    assert.equal(setting.hasApiKey, true); assert.ok(setting.revision);
    assert.ok(!Object.keys(setting).some((key) => /encrypted|secret|^apiKey$/i.test(key)));
  }
  report.credentialsHidden = true; report.settings = true;
  const models = await (await request("/api/models")).json();
  const agent = settings.find((setting) => setting.purpose === "agent");
  assert.ok(models.models.some((item) => item.providerId === "vibehard" && item.model === agent.model));
  report.platform = true;
  if (live) {
    for (const setting of settings) {
      const res = await request("/api/admin/llm/test", { method: "POST", body: JSON.stringify({ purpose: setting.purpose, baseUrl: setting.baseUrl, model: setting.model, protocol: setting.protocol, revision: setting.revision }) });
      const data = await res.json(); report.live[setting.purpose] = { status: res.status, ok: data.ok === true, latencyMs: data.latencyMs, error: data.error };
      console.log(JSON.stringify({ providerTest: setting.purpose, ...report.live[setting.purpose] }));
    }
    if (report.live.design.ok) {
      const res = await request("/api/design", { method: "POST", body: JSON.stringify({ requirement: "设计一个 USB 供电的温湿度监测器，使用 I2C 传感器，给出简短方案。" }) });
      const events = (await res.text()).trim().split("\n").map((line) => JSON.parse(line));
      report.live.designGeneration = { ok: events.some((event) => event.type === "result" && event.result.architecture.length), error: events.find((event) => event.type === "error")?.error };
      console.log(JSON.stringify({ designGeneration: report.live.designGeneration }));
    }
    // Even if the small API probe failed, verify the actual Agent path terminates cleanly.
    const created = await request("/api/projects", { method: "POST", body: JSON.stringify({ name: "LLM release verification", workspaceKey: `llm-verify-${Date.now()}`, runnerKey: "cloud-runner" }) });
    assert.equal(created.status, 201); ({ project } = await created.json());
    const threadRes = await request(`/api/projects/${project.id}/threads`, { method: "POST", body: JSON.stringify({ title: "LLM verification" }) });
    assert.equal(threadRes.status, 201); const { thread } = await threadRes.json();
    const marker = `LLM_OK_${randomUUID().slice(0, 8)}`;
    const turnRes = await request(`/api/threads/${thread.id}/turns`, { method: "POST", body: JSON.stringify({ input: `Do not use tools. Reply with exactly ${marker}`, model: agent.model, providerId: "vibehard" }) });
    assert.equal(turnRes.status, 202); const { turn } = await turnRes.json();
    let overview; let finished;
    for (let i = 0; i < 160; i++) {
      overview = await (await request(`/api/threads/${thread.id}`)).json();
      finished = overview.turns.find((item) => item.id === turn.id);
      if (["completed", "failed", "interrupted"].includes(finished?.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!["completed", "failed", "interrupted"].includes(finished?.status)) {
      await request(`/api/threads/${thread.id}/interrupt`, { method: "POST", body: "{}" });
      throw new Error("Agent did not terminate before the verification deadline");
    }
    const output = overview.events.filter((event) => event.type.startsWith("agent.message")).map((event) => event.data.text ?? "").join("");
    report.live.agentTurn = { status: finished.status, replyVerified: finished.status === "completed" && output.includes(marker), error: finished.error, taskId: turn.id };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  query(`delete from users where id='${memberId}' and email='${member.email}'`);
  if (project) {
    assert.match(project.id, /^[0-9a-f-]{36}$/);
    const active = query(`select count(*) from agent_turns t join agent_threads h on h.id=t.thread_id where h.project_id='${project.id}' and t.status in ('queued','running','waiting_approval')`);
    if (active === "0") {
      query(`delete from projects where id='${project.id}' and name='LLM release verification'`);
      const evidence = "/opt/vibehard/releases/20260918-llm-settings/verification-workspaces";
      await mkdir(evidence, { recursive: true, mode: 0o700 });
      for (const [root, suffix] of [["/var/lib/vibehard-runner/workspaces", "workspace"], ["/var/lib/vibehard-runner/codex", "codex"]]) {
        const source = path.join(root, project.workspaceKey);
        assert.ok(source.startsWith(root + "/"));
        if (existsSync(source)) await rename(source, path.join(evidence, `${project.id}-${suffix}`));
      }
    }
  }
  if (!project || query(`select count(*) from projects where id='${project.id}'`) === "0") query(`delete from users where id='${adminId}' and email='${admin.email}'`);
}
