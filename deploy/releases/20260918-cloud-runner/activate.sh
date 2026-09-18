#!/usr/bin/env bash
set -Eeuo pipefail

release=/opt/vibehard/releases/20260918-cloud-runner
platform_unit=/etc/systemd/system/vibehard.service
gateway_unit=/etc/systemd/system/vibehard-gateway.service
runner_unit=/etc/systemd/system/vibehard-runner.service
platform_env=/etc/vibehard/platform.env
backup=/opt/vibehard/backups/20260918-before-cloud

test "$(systemctl show -p WorkingDirectory --value vibehard.service)" = /opt/vibehard/releases/20260916-pcb-restore/standalone
test "$(systemctl show -p WorkingDirectory --value vibehard-gateway.service)" = /opt/vibehard/releases/20260830-1825
test -f "$release/standalone/server.js"
test -f "$release/services/gateway.cjs"
test -f "$release/services/runner.cjs"
mkdir -p "$backup"
chmod 700 "$backup"
cp -a "$platform_unit" "$release/vibehard.service.previous"
cp -a "$gateway_unit" "$release/vibehard-gateway.service.previous"
cp -a "$platform_env" "$release/platform.env.previous"
chmod 600 "$release/platform.env.previous"

rollback() {
  trap - ERR
  echo "Activation failed; restoring the previous VibeHard platform and Gateway units." >&2
  systemctl stop vibehard-runner.service 2>/dev/null || true
  cp -a "$release/vibehard.service.previous" "$platform_unit"
  cp -a "$release/vibehard-gateway.service.previous" "$gateway_unit"
  cp -a "$release/platform.env.previous" "$platform_env"
  systemctl daemon-reload
  systemctl restart vibehard-gateway.service
  systemctl restart vibehard.service
  exit 1
}
trap rollback ERR

# Stop localhost-only preflight services after their checks have passed.
systemctl stop vibehard-cloud-runner-preflight.service vibehard-cloud-gateway-preflight.service vibehard-cloud-preflight.service \
  vibehard-release-final-gateway.service vibehard-release-final-platform.service 2>/dev/null || true

# Refresh the production DB backup before applying the additive migration.
/usr/local/bin/node --env-file="$platform_env" --input-type=module - <<'NODE'
import { chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
const u = new URL(process.env.DATABASE_URL);
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) };
const output = "/opt/vibehard/backups/20260918-before-cloud/platform.dump";
const result = spawnSync("/usr/bin/pg_dump", ["-Fc", "-f", output], { env, encoding: "utf8" });
if (result.status !== 0) process.exit(1);
chmodSync(output, 0o600);
NODE

(cd "$release" && /usr/local/bin/node --env-file="$platform_env" services/migrate.cjs)

/usr/local/bin/node --env-file="$platform_env" --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path = "/etc/vibehard/platform.env";
const current = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
const updates = {
  DEFAULT_RUNNER_KEY: "cloud-runner",
  ARTIFACT_RUNNER_KEY: "cloud-runner",
  ARTIFACT_WORKSPACE_ROOT: "/var/lib/vibehard-runner/workspaces",
};
const next = current.filter(line => !Object.keys(updates).some(key => line.startsWith(`${key}=`)));
for (const [key, value] of Object.entries(updates)) next.push(`${key}=${value}`);
writeFileSync(path, `${next.join("\n")}\n`, { mode: 0o600 });

const u = new URL(process.env.DATABASE_URL);
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) };
const sql = `insert into model_profiles (provider_id,model,display_name,capabilities,enabled) values ('tokenadvent','gpt-5.6-sol','GPT-5.6 Sol','["tools","reasoning"]'::jsonb,true) on conflict (provider_id,model) do update set display_name=excluded.display_name,capabilities=excluded.capabilities,enabled=true,updated_at=now()`;
const result = spawnSync("/usr/bin/psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" });
if (result.status !== 0) process.exit(1);
NODE

sed "s#^WorkingDirectory=.*#WorkingDirectory=$release/standalone#" "$platform_unit" > "$release/vibehard.service"
sed "s#^WorkingDirectory=.*#WorkingDirectory=$release#" "$gateway_unit" > "$release/vibehard-gateway.service"
install -m 644 "$release/vibehard.service" "$platform_unit"
install -m 644 "$release/vibehard-gateway.service" "$gateway_unit"
install -m 644 "$release/deploy/systemd/vibehard-runner.service" "$runner_unit"
install -m 755 "$release/deploy/runner/codex-sandbox.sh" /opt/vibehard/cloud-runner/codex-sandbox.sh
install -m 644 "$release/services/runner.cjs" /opt/vibehard/cloud-runner/runner.cjs
install -m 640 -o root -g vibehard-runner "$release/deploy/runner/config.toml" /etc/vibehard/codex/config.toml
chgrp vibehard-runner /etc/vibehard
chmod 710 /etc/vibehard
chmod 600 /etc/vibehard/platform.env /etc/vibehard/model.env

systemctl daemon-reload
systemctl restart vibehard-gateway.service
systemctl restart vibehard.service
ready=0
for ((attempt=0; attempt<30; attempt++)); do
  if curl -fsS http://127.0.0.1:3210/vibehard/login >/dev/null && curl -fsS http://172.17.0.1:8787/health >/dev/null; then ready=1; break; fi
  sleep 1
done
test "$ready" -eq 1

# Register the dedicated cloud Runner without exposing the returned secret.
/usr/local/bin/node --env-file="$platform_env" --input-type=module - <<'NODE'
import { writeFileSync } from "node:fs";
const response = await fetch("http://127.0.0.1:3210/vibehard/api/runners/register", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.RUNNER_REGISTRATION_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ runnerKey: "cloud-runner", name: "VibeHard Cloud Runner", capabilities: ["codex", "workspace-read", "workspace-write-approval", "gcc", "cmake"] }),
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Cloud Runner registration failed: ${response.status}`);
const credential = await response.json();
if (typeof credential.secret !== "string" || credential.secret.length < 32) throw new Error("Invalid cloud Runner credential");
const environment = [
  "RUNNER_ID=cloud-runner",
  "RUNNER_NAME=VibeHard Cloud Runner",
  "RUNNER_GATEWAY_URL=ws://172.17.0.1:8787/runner",
  `RUNNER_SHARED_SECRET=${credential.secret}`,
  "RUNNER_WORKSPACE_ROOT=/var/lib/vibehard-runner/workspaces",
  "RUNNER_STATE_FILE=/var/lib/vibehard-runner/state.json",
  "RUNNER_CREDENTIAL_FILE=/var/lib/vibehard-runner/credential.json",
  "RUNNER_MAX_CONCURRENT_TASKS=1",
  "RUNNER_CODEX_WRAPPER=[\"/opt/vibehard/cloud-runner/codex-sandbox.sh\",\"{workspace}\"]",
  "CODEX_BIN=/opt/vibehard/toolchain/bin/codex",
  "CODEX_PROVIDER_ENV_ALLOWLIST=CLOUD_MODEL_API_KEY",
  "CODEX_REQUEST_TIMEOUT_MS=90000",
];
writeFileSync("/etc/vibehard/runner.env", `${environment.join("\n")}\n`, { mode: 0o600 });
NODE

systemctl enable --now vibehard-runner.service
connected=0
for ((attempt=0; attempt<30; attempt++)); do
  if ss -tnp | grep -q '172.17.0.1:8787'; then connected=1; break; fi
  sleep 1
done
test "$connected" -eq 1

trap - ERR
systemctl show vibehard.service vibehard-gateway.service vibehard-runner.service -p Id -p ActiveState -p MainPID -p WorkingDirectory --no-pager
