// Verify thread/start accepts managed provider overrides in the pinned binary.
// No turn is started, so this does not call an external LLM.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
const workspace = "/var/lib/vibehard-runner/workspaces/verification/llm-settings-protocol";
assert.equal(spawnSync("install", ["-d", "-o", "vibehard-runner", "-g", "vibehard-runner", "-m", "700", workspace]).status, 0);
const child = spawn("runuser", ["-u", "vibehard-runner", "--", "/opt/vibehard/cloud-runner/codex-sandbox.sh", workspace, "app-server", "--listen", "stdio://"], { env: { PATH: process.env.PATH, HOME: "/var/lib/vibehard-runner", VIBEHARD_MODEL_API_KEY: "protocol-verification-placeholder" }, stdio: ["pipe", "pipe", "pipe"] });
const pending = new Map(); let id = 0;
const lines = createInterface({ input: child.stdout });
lines.on("line", (line) => { const m = JSON.parse(line); if (m.id !== undefined && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(JSON.stringify(m.error))); else p.resolve(m.result); } });
const send = (method, params) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); child.stdin.write(JSON.stringify({ id: next, method, params }) + "\n"); });
const timer = setTimeout(() => { child.kill(); process.exitCode = 1; }, 20_000);
try {
  await send("initialize", { clientInfo: { name: "llm-config-check", version: "1" }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
  const result = await send("thread/start", { model: "verification-only", modelProvider: "vibehard", cwd: workspace, ephemeral: true, sandbox: "read-only", approvalPolicy: "on-request", config: { "model_providers.vibehard": { name: "VibeHard test", base_url: "https://example.com/v1", env_key: "VIBEHARD_MODEL_API_KEY", wire_api: "responses", request_max_retries: 1, stream_max_retries: 1, stream_idle_timeout_ms: 60000 }, "shell_environment_policy.exclude": ["*KEY*", "*TOKEN*", "*SECRET*", "*PASSWORD*"] } });
  assert.ok(result.thread?.id); assert.equal(result.modelProvider, "vibehard");
  console.log(JSON.stringify({ pinnedCodexManagedProvider: true, externalModelCalled: false }));
} finally { clearTimeout(timer); lines.close(); child.kill(); }
