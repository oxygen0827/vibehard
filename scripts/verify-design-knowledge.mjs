import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";

const base = process.argv[2];
const staticOnly = process.argv.includes("--static");
assert.match(base ?? "", /^(http:\/\/127\.0\.0\.1:321[01]|https:\/\/ldcx\.tech)\/vibehard$/);
assert.ok(process.env.SESSION_SECRET);
const renderPayload = Buffer.from(JSON.stringify({ id: "design-render-check", email: "render@example.invalid", name: "Render Check", role: "member", exp: Date.now() + 60_000 })).toString("base64url");
const renderSignature = createHmac("sha256", process.env.SESSION_SECRET).update(renderPayload).digest("base64url");
const page = await fetch(`${base}/app/design`, { headers: { Cookie: `vibehard_session=${renderPayload}.${renderSignature}` }, redirect: "manual", signal: AbortSignal.timeout(10_000) });
assert.equal(page.status, 200);
const html = await page.text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
const bundles = await Promise.all(scripts.map(async (source) => {
  const response = await fetch(new URL(source, base).toString(), { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200, `Could not fetch ${source}`);
  return response.text();
}));
const code = bundles.join("\n");
assert.ok(code.includes("已接入内置方案知识库，BOM 将自动填写人民币参考单价。"));
assert.ok(code.includes("参考单价（人民币）"));
assert.ok(!code.includes("直接调用管理员配置的模型，当前不接入知识库。"));
if (staticOnly) {
  console.log(JSON.stringify({ base, knowledgeCopy: true, priceColumn: true }));
  process.exit(0);
}

assert.ok(process.env.DATABASE_URL);
assert.ok(process.env.SESSION_SECRET);
const database = new URL(process.env.DATABASE_URL);
const env = { ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432", PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: database.pathname.slice(1) };
const query = spawnSync("/usr/bin/psql", ["-X", "-t", "-A", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", "select id,email,name from users where role='admin' order by created_at limit 1"], { env, encoding: "utf8" });
assert.equal(query.status, 0);
const [id, email, name] = query.stdout.trim().split("\t");
assert.ok(id && email);
const payload = Buffer.from(JSON.stringify({ id, email, name, role: "admin", exp: Date.now() + 300_000 })).toString("base64url");
const signature = createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
const response = await fetch(`${base}/api/design`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: `vibehard_session=${payload}.${signature}` },
  body: JSON.stringify({ requirement: "生成一个 USB 供电、带温度传感器和状态指示灯的最小测试节点，请给出 BOM。" }),
  signal: AbortSignal.timeout(100_000),
});
assert.equal(response.status, 200);
const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
const failure = events.find((event) => event.type === "error");
assert.ok(!failure, failure?.error);
const result = events.find((event) => event.type === "result");
assert.equal(result?.knowledgeBase?.id, "platform-hardware-design");
assert.ok(result?.knowledgeBase?.version);
assert.ok(result?.result?.bom?.length > 0);
for (const row of result.result.bom) {
  assert.match(row.estCost, /[¥￥]\s*\d/);
  assert.doesNotMatch(row.estCost, /未核价|待核价|待询价|询价后/);
}
console.log(JSON.stringify({ base, knowledgeBase: result.knowledgeBase, bomRows: result.result.bom.length, everyRowHasPrice: true }));
