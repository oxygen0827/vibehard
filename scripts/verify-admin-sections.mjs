import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";

const base = process.argv[2];
assert.match(base ?? "", /^http:\/\/127\.0\.0\.1:321[01]\/vibehard$/);
assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
assert.ok(process.env.SESSION_SECRET, "SESSION_SECRET is required");
const database = new URL(process.env.DATABASE_URL);
const env = {
  ...process.env,
  PGHOST: database.hostname,
  PGPORT: database.port || "5432",
  PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password),
  PGDATABASE: database.pathname.slice(1),
};
const query = spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", "select id,email,name from users where role='admin' order by created_at limit 1"], { env, encoding: "utf8" });
assert.equal(query.status, 0, "Could not read the verification administrator");
const [id, email, name] = query.stdout.trim().split("\t");
assert.ok(id && email, "At least one administrator is required");
const payload = Buffer.from(JSON.stringify({ id, email, name, role: "admin", exp: Date.now() + 300_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const cookie = `vibehard_session=${payload}.${signature}`;
const page = await fetch(`${base}/app/admin`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(10_000) });
assert.equal(page.status, 200);
const html = await page.text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
assert.ok(scripts.length, "Admin page did not reference any JavaScript bundles");
const bundles = await Promise.all(scripts.map(async (source) => {
  const response = await fetch(new URL(source, base).toString(), { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `Could not fetch ${source}`);
  return response.text();
}));
const code = bundles.join("\n");
for (const label of ["管理功能分区", "概览", "模型设置", "Runner 节点", "用户管理", "审计日志", "按功能分区管理平台"]) assert.ok(code.includes(label), `Admin bundle is missing ${label}`);
const overview = await fetch(`${base}/api/admin/overview`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(10_000) });
assert.equal(overview.status, 200, "Administrator overview API is unavailable");
const data = await overview.json();
assert.ok(data.users.some((user) => user.email === email && user.role === "admin"));
console.log(JSON.stringify({ base, adminSections: 5, adminBundle: true, overviewApi: true }));
