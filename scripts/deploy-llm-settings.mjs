// Version-specific deployment. Run on the existing server as root.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const release = "/opt/vibehard/releases/20260918-llm-settings";
const previous = "/opt/vibehard/releases/20260918-cloud-runner";
const preflightDb = "vibehard_llm_preflight_20260918";
const mode = process.argv[2];
assert.ok(["prepare", "activate", "rollback"].includes(mode));
assert.equal(process.getuid(), 0);
assert.ok(existsSync(`${release}/standalone/server.js`));
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`Deployment command failed: ${command} ${args[0] ?? ""} (details suppressed to protect configuration)`);
  return result.stdout.trim();
};
const node = "/usr/local/bin/node";
const u = new URL(process.env.DATABASE_URL);
const pgEnv = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) };
const query = (sql) => run("/usr/bin/psql", ["-X", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: pgEnv });
const unit = "/etc/systemd/system/vibehard.service";
const runnerEnv = "/etc/vibehard/runner.env";
const runnerBundle = "/opt/vibehard/cloud-runner/runner.cjs";
const backup = `${release}/backup`;
const inactive = () => assert.equal(query("select count(*) from agent_turns where status in ('queued','running','waiting_approval')"), "0", "Active tasks must finish before activation");
const verify = (port) => run(node, ["--env-file=/etc/vibehard/platform.env", `${release}/scripts/verify-frontend-release.mjs`, `http://127.0.0.1:${port}`, `${release}/standalone`]);
const ready = async (port) => {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/vibehard/login`, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Platform did not become ready");
};

if (mode === "prepare") {
  assert.equal(run("systemctl", ["show", "-p", "WorkingDirectory", "--value", "vibehard.service"]), `${previous}/standalone`);
  assert.equal(query(`select count(*) from pg_database where datname='${preflightDb}'`), "0", "Preflight DB already exists; inspect before reusing");
  mkdirSync(backup, { recursive: true, mode: 0o700 }); chmodSync(backup, 0o700);
  run("/usr/bin/pg_dump", ["-Fc", "-f", `${backup}/platform.dump`], { env: pgEnv }); chmodSync(`${backup}/platform.dump`, 0o600);
  run("runuser", ["-u", "postgres", "--", "createdb", "-O", pgEnv.PGUSER, preflightDb]);
  run("/usr/bin/pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", "-d", preflightDb, `${backup}/platform.dump`], { env: pgEnv });
  u.pathname = `/${preflightDb}`;
  const environment = readFileSync("/etc/vibehard/platform.env", "utf8").split(/\r?\n/).filter((line) => !line.startsWith("DATABASE_URL="));
  environment.push(`DATABASE_URL=${u.toString()}`);
  writeFileSync(`${release}/preflight.env`, environment.join("\n") + "\n", { mode: 0o600 });
  const preflightEnvironment = { ...process.env, DATABASE_URL: u.toString() };
  run(node, [`--env-file=${release}/preflight.env`, `${release}/services/migrate.cjs`], { cwd: release, env: preflightEnvironment });
  run(node, [`--env-file=${release}/preflight.env`, "--env-file=/etc/vibehard/model.env", `${release}/services/llm-bootstrap.cjs`], { env: preflightEnvironment });
  run("systemd-run", ["--unit=vibehard-llm-preflight", "--property=Type=simple", `--property=WorkingDirectory=${release}/standalone`, `--property=EnvironmentFile=${release}/preflight.env`, "--setenv=NODE_ENV=production", "--setenv=HOSTNAME=127.0.0.1", "--setenv=PORT=3211", node, "server.js"]);
  await ready(3211); verify(3211);
  console.log("Isolated database migrated; preview ready on localhost:3211; PCB/Demo verified");
}
if (mode === "rollback") {
  for (const file of ["vibehard.service", "runner.env", "runner.cjs"]) assert.ok(existsSync(`${backup}/${file}`));
  copyFileSync(`${backup}/vibehard.service`, unit); copyFileSync(`${backup}/runner.env`, runnerEnv); chmodSync(runnerEnv, 0o600); copyFileSync(`${backup}/runner.cjs`, runnerBundle);
  run("systemctl", ["daemon-reload"]); run("systemctl", ["restart", "vibehard.service", "vibehard-runner.service"]);
  console.log("Restored prior platform and Runner; additive settings table retained");
}
if (mode === "activate") {
  inactive(); verify(3211);
  assert.equal(run("systemctl", ["show", "-p", "WorkingDirectory", "--value", "vibehard.service"]), `${previous}/standalone`);
  const protectedPid = run("systemctl", ["show", "-p", "MainPID", "--value", "vibeboard.service"]);
  const gatewayPid = run("systemctl", ["show", "-p", "MainPID", "--value", "vibehard-gateway.service"]);
  for (const [src, name] of [[unit, "vibehard.service"], [runnerEnv, "runner.env"], [runnerBundle, "runner.cjs"]]) { copyFileSync(src, `${backup}/${name}`); chmodSync(`${backup}/${name}`, 0o600); }
  run("/usr/bin/pg_dump", ["-Fc", "-f", `${backup}/platform-before-activation.dump`], { env: pgEnv }); chmodSync(`${backup}/platform-before-activation.dump`, 0o600);
  run(node, ["--env-file=/etc/vibehard/platform.env", `${release}/services/migrate.cjs`], { cwd: release });
  run(node, ["--env-file=/etc/vibehard/platform.env", "--env-file=/etc/vibehard/model.env", `${release}/services/llm-bootstrap.cjs`]);
  try {
    const currentUnit = readFileSync(unit, "utf8").replace(/^WorkingDirectory=.*$/m, `WorkingDirectory=${release}/standalone`);
    writeFileSync(unit, currentUnit);
    const env = readFileSync(runnerEnv, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("RUNNER_PLATFORM_URL="));
    env.push("RUNNER_PLATFORM_URL=http://127.0.0.1:3210/vibehard");
    writeFileSync(runnerEnv, env.join("\n") + "\n", { mode: 0o600 });
    copyFileSync(`${release}/services/runner.cjs`, runnerBundle);
    run("systemctl", ["daemon-reload"]); run("systemctl", ["restart", "vibehard.service", "vibehard-runner.service"]);
    await ready(3210); verify(3210);
    assert.equal(run("systemctl", ["show", "-p", "MainPID", "--value", "vibeboard.service"]), protectedPid);
    assert.equal(run("systemctl", ["show", "-p", "MainPID", "--value", "vibehard-gateway.service"]), gatewayPid);
    run("systemctl", ["stop", "vibehard-llm-preflight.service"]);
    console.log("Activated managed LLM settings; platform/Runner restarted; Gateway/VibeBoard preserved");
  } catch (error) {
    run(node, ["--env-file=/etc/vibehard/platform.env", `${release}/scripts/deploy-llm-settings.mjs`, "rollback"]);
    throw error;
  }
}
