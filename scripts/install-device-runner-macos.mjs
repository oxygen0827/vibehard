import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

assert.equal(process.platform, "darwin", "This installer is for macOS");
const [credentialPath, modelEnvPath, runnerBundle, installRoot, workspaceRoot] = process.argv.slice(2);
for (const value of [credentialPath, modelEnvPath, runnerBundle, installRoot, workspaceRoot]) assert.ok(value && path.isAbsolute(value), "Pass five absolute paths");
assert.ok(installRoot.includes(`${path.sep}Library${path.sep}Application Support${path.sep}VibeHardRunner`), "Unexpected install root");
assert.ok(workspaceRoot.endsWith(`${path.sep}.runner-workspaces`), "Unexpected workspace root");
const credential = JSON.parse(await readFile(credentialPath, "utf8"));
assert.equal(credential.runnerKey, "device-runner");
assert.ok(typeof credential.secret === "string" && credential.secret.length >= 32);
const modelEnv = Object.fromEntries((await readFile(modelEnvPath, "utf8")).split(/\r?\n/).filter(line => line && !line.startsWith("#")).map(line => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1).trim()]; }));
assert.ok(modelEnv.CLOUD_MODEL_API_KEY);
assert.equal(modelEnv.CLOUD_MODEL_NAME, "gpt-5.6-sol");
const node = process.execPath;
const npm = path.join(path.dirname(node), "npm");
const uid = process.getuid?.();
assert.ok(uid && uid > 0);
const launchAgents = path.join(path.dirname(path.dirname(installRoot)), "LaunchAgents");
const plist = path.join(launchAgents, "tech.ldcx.vibehard-device-runner.plist");
const codexHome = path.join(installRoot, "codex");
const logs = path.join(installRoot, "logs");
const toolchain = path.join(installRoot, "toolchain");
await mkdir(codexHome, { recursive: true, mode: 0o700 });
await mkdir(logs, { recursive: true, mode: 0o700 });
await mkdir(workspaceRoot, { recursive: true, mode: 0o700 });
await mkdir(launchAgents, { recursive: true, mode: 0o700 });
const install = spawnSync(npm, ["install", "--prefix", toolchain, "@openai/codex@0.149.1"], { stdio: "inherit" });
assert.equal(install.status, 0, "Codex CLI installation failed");
const installedCodex = path.join(toolchain, "node_modules", ".bin", "codex");
await copyFile(runnerBundle, path.join(installRoot, "runner.cjs"));
await chmod(path.join(installRoot, "runner.cjs"), 0o600);
const env = {
  NODE_ENV: "production",
  RUNNER_ID: "device-runner",
  RUNNER_NAME: "VibeHard Mac mini Device Runner",
  RUNNER_GATEWAY_URL: "wss://ldcx.tech/vibehard/runner",
  RUNNER_SHARED_SECRET: credential.secret,
  RUNNER_WORKSPACE_ROOT: workspaceRoot,
  RUNNER_STATE_FILE: path.join(installRoot, "state.json"),
  RUNNER_CREDENTIAL_FILE: path.join(installRoot, "credential.json"),
  RUNNER_MAX_CONCURRENT_TASKS: "1",
  RUNNER_CAPABILITIES: "codex,workspace-read,workspace-write-approval,usb-device,serial,flash",
  CODEX_BIN: installedCodex,
  CODEX_HOME: codexHome,
  CODEX_PROVIDER_ENV_ALLOWLIST: "CLOUD_MODEL_API_KEY",
  CODEX_REQUEST_TIMEOUT_MS: "90000",
  CLOUD_MODEL_API_KEY: modelEnv.CLOUD_MODEL_API_KEY,
};
await writeFile(path.join(installRoot, "runner.env"), Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
await writeFile(path.join(codexHome, "config.toml"), [
  'model = "gpt-5.6-sol"',
  'model_provider = "tokenadvent"',
  "",
  "[model_providers.tokenadvent]",
  'name = "TokenAdvent"',
  'base_url = "https://tokenadvent.com/v1"',
  'env_key = "CLOUD_MODEL_API_KEY"',
  'wire_api = "responses"',
  "",
].join("\n"), { mode: 0o600 });
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>tech.ldcx.vibehard-device-runner</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>--env-file=${path.join(installRoot, "runner.env")}</string><string>${path.join(installRoot, "runner.cjs")}</string></array>
  <key>WorkingDirectory</key><string>${installRoot}</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>${path.join(logs, "runner.log")}</string>
  <key>StandardErrorPath</key><string>${path.join(logs, "runner.error.log")}</string>
  <key>SoftResourceLimits</key><dict><key>NumberOfFiles</key><integer>2048</integer></dict>
</dict></plist>\n`;
await writeFile(plist, xml, { mode: 0o600 });
spawnSync("/bin/launchctl", ["bootout", `gui/${uid}`, plist], { stdio: "ignore" });
const bootstrap = spawnSync("/bin/launchctl", ["bootstrap", `gui/${uid}`, plist], { encoding: "utf8" });
if (bootstrap.status !== 0) throw new Error(`launchctl bootstrap failed: ${bootstrap.stderr.trim()}`);
const kickstart = spawnSync("/bin/launchctl", ["kickstart", "-k", `gui/${uid}/tech.ldcx.vibehard-device-runner`], { encoding: "utf8" });
assert.equal(kickstart.status, 0, kickstart.stderr);
console.log(JSON.stringify({ label: "tech.ldcx.vibehard-device-runner", runnerKey: "device-runner", installRoot, workspaceRoot, codexVersion: "0.149.1", secretsPrinted: false }));
