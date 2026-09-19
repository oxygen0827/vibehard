import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const release = "/opt/vibehard/releases/20260919-design-knowledge-pricing";
const previous = "/opt/vibehard/releases/20260919-auth-cookies";
const unit = "/etc/systemd/system/vibehard.service";
const backup = `${release}/backup`;
const mode = process.argv[2];
assert.ok(["preflight", "activate", "rollback"].includes(mode));
assert.equal(process.getuid(), 0);
assert.ok(existsSync(`${release}/standalone/server.js`));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`Deployment command failed: ${command} ${args[0] ?? ""}`);
  return result.stdout.trim();
};
const node = "/usr/local/bin/node";
const verify = (port) => {
  run(node, [`${release}/scripts/verify-auth-cookies.mjs`, `http://127.0.0.1:${port}/vibehard`]);
  run(node, [`${release}/scripts/verify-design-knowledge.mjs`, `http://127.0.0.1:${port}/vibehard`, "--static"]);
  run(node, ["--env-file=/etc/vibehard/platform.env", `${release}/scripts/verify-frontend-release.mjs`, `http://127.0.0.1:${port}`, `${release}/standalone`]);
  run(node, ["--env-file=/etc/vibehard/platform.env", `${release}/scripts/verify-admin-sections.mjs`, `http://127.0.0.1:${port}/vibehard`]);
};
const ready = async (port) => {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/vibehard/login`, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Platform did not become ready");
};
const workingDirectory = () => run("systemctl", ["show", "-p", "WorkingDirectory", "--value", "vibehard.service"]);
const activeTurns = () => {
  const database = new URL(process.env.DATABASE_URL);
  const env = { ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432", PGUSER: decodeURIComponent(database.username), PGPASSWORD: decodeURIComponent(database.password), PGDATABASE: database.pathname.slice(1) };
  return run("/usr/bin/psql", ["-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", "select count(*) from agent_turns where status in ('queued','running','waiting_approval')"], { env });
};

if (mode === "preflight") {
  assert.equal(workingDirectory(), `${previous}/standalone`);
  run("systemd-run", ["--unit=vibehard-design-knowledge-preflight", "--property=Type=simple", `--property=WorkingDirectory=${release}/standalone`, "--property=EnvironmentFile=/etc/vibehard/platform.env", "--setenv=NODE_ENV=production", "--setenv=HOSTNAME=127.0.0.1", "--setenv=PORT=3211", node, "server.js"]);
  await ready(3211);
  verify(3211);
  console.log("Design knowledge preflight passed on localhost:3211");
}
if (mode === "rollback") {
  assert.ok(existsSync(`${backup}/vibehard.service`));
  copyFileSync(`${backup}/vibehard.service`, unit);
  run("systemctl", ["daemon-reload"]);
  run("systemctl", ["restart", "vibehard.service"]);
  await ready(3210);
  console.log("Restored the previous platform unit");
}
if (mode === "activate") {
  assert.equal(activeTurns(), "0", "Active tasks must finish before platform restart");
  assert.equal(workingDirectory(), `${previous}/standalone`);
  verify(3211);
  mkdirSync(backup, { recursive: true, mode: 0o700 });
  copyFileSync(unit, `${backup}/vibehard.service`);
  const protectedPid = run("systemctl", ["show", "-p", "MainPID", "--value", "vibeboard.service"]);
  const gatewayPid = run("systemctl", ["show", "-p", "MainPID", "--value", "vibehard-gateway.service"]);
  try {
    const nextUnit = readFileSync(unit, "utf8").replace(/^WorkingDirectory=.*$/m, `WorkingDirectory=${release}/standalone`);
    writeFileSync(unit, nextUnit);
    run("systemctl", ["daemon-reload"]);
    run("systemctl", ["restart", "vibehard.service"]);
    await ready(3210);
    verify(3210);
    assert.equal(run("systemctl", ["show", "-p", "MainPID", "--value", "vibeboard.service"]), protectedPid);
    assert.equal(run("systemctl", ["show", "-p", "MainPID", "--value", "vibehard-gateway.service"]), gatewayPid);
    run("systemctl", ["stop", "vibehard-design-knowledge-preflight.service"]);
    console.log("Activated design knowledge pricing; Gateway, VibeBoard and nginx were preserved");
  } catch (error) {
    copyFileSync(`${backup}/vibehard.service`, unit);
    run("systemctl", ["daemon-reload"]);
    run("systemctl", ["restart", "vibehard.service"]);
    throw error;
  }
}
