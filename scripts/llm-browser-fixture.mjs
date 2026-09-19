// Temporary, login-capable UI verification account. Remove immediately after testing.
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
const file = "/tmp/vibehard-llm-browser-fixture.json";
const u = new URL(process.env.DATABASE_URL);
assert.equal(u.pathname, "/vibehard_llm_preflight_20260918", "Browser fixtures are restricted to the isolated preflight database");
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) };
const query = (sql) => { const result = spawnSync("/usr/bin/psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" }); assert.equal(result.status, 0, "Fixture query failed"); };
if (process.argv[2] === "create") {
  assert.ok(!existsSync(file), "Fixture already exists; clean it up first");
  const id = randomUUID(); const email = `llm-ui-${id}@example.invalid`; const password = randomBytes(20).toString("base64url");
  const salt = randomBytes(16).toString("hex"); const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  query(`insert into users(id,email,name,password_hash,role) values ('${id}','${email}','Temporary LLM UI check','${hash}','admin')`);
  writeFileSync(file, JSON.stringify({ id, email, password }), { mode: 0o600 });
  console.log(JSON.stringify({ email, password, temporaryVerificationAccount: true }));
} else {
  assert.equal(process.argv[2], "delete"); const { id, email } = JSON.parse(readFileSync(file, "utf8"));
  assert.match(id, /^[0-9a-f-]{36}$/); assert.equal(email, `llm-ui-${id}@example.invalid`);
  query(`delete from users where id='${id}' and email='${email}'`); unlinkSync(file);
  console.log("Temporary browser verification account removed");
}
