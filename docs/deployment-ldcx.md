# ldcx.tech deployment

## Current deployment

As of 2026-09-16:

- Active frontend release: `/opt/vibehard/releases/20260916-pcb-restore/standalone`.
- Previous frontend release retained for rollback: `/opt/vibehard/releases/20260910-demo-copy/standalone` (contains the old PCB preview).
- Previous systemd unit: `/opt/vibehard/releases/20260916-pcb-restore/vibehard.service.previous`.
- Gateway remains on `/opt/vibehard/releases/20260830-1825`; it was not restarted during this frontend release.
- Platform and Gateway run on `47.102.197.71`.
- The Codex Runner is configured for the development Mac with workspace root `/Users/hushaohong/vibehard/.runner-workspaces`, but was not running at the 2026-09-16 status check. The last heartbeat was 2026-08-31 19:21:39 +08:00; the stored `online` flag is stale. See [current-status.md](current-status.md).
- The server does not yet have an installed and authenticated Codex CLI, so it does not run the Agent executor.

### PCB and showcase release, 2026-09-05

The server database was checked read-only and still lacks migration `0002` (`runner_nodes.instance_id` is absent). To avoid introducing the pending backend/Runner changes in a visual update, this release was built from foundation commit `96c4991` with the current PCB preview, demo page/media, BOM empty-state fix, login/register copy and homepage demo links overlaid in a separate build directory. It does not include the newer admin overview or Runner hardening commits. The main working tree was not reverted.

Build staging directory: `/tmp/vibehard-release-20260905-jGzLdU`. The published source snapshot and release manifest are retained alongside the server release. `release-v2.tar.gz` SHA-256: `4e8e5084fbc61ff54e39c2f8d4c14b00e8038209d30131b8dced04e2ae1f0d7e`.

The package preserves relative pnpm symlinks, includes `public`, `.next/static` and `@swc/helpers/esm`, and excludes macOS sharp native packages. It was preflighted on loopback port `3211`, then verified on port `3210` and `https://ldcx.tech`: login page, protected PCB page rendering, unauthenticated API rejection, detailed PCB client bundle, demo page and all five MP4 resources. The temporary preview service was stopped. VibeBoard and Gateway process IDs stayed unchanged. No database migration or nginx change was performed.

To roll back, restore the saved unit to `/etc/systemd/system/vibehard.service`, run `systemctl daemon-reload`, then restart only `vibehard.service`. The existing unit uses an explicit release path; there is no `/opt/vibehard/current` symlink.

### Demo GIF release, 2026-09-09

The `/vibehard/demo` page was refreshed to use native animated GIF media for all five workflow recordings. This release was built from the same deployment baseline `96c4991` with only `app/demo`, `public/demo` and `next.config.ts` overlaid, so the production database and Runner/Gateway services were not changed. It was preflighted on port `3211` and then activated on port `3210`; `vibeboard.service` and Gateway PIDs stayed unchanged.

### Demo copy layout release, 2026-09-10

The five module descriptions on `/vibehard/demo` were moved beneath their section titles and reduced in size. The lower module-introduction blocks were also restyled with clearer label, copy and metadata hierarchy. This release was built from baseline `96c4991` with only `app/demo`, `public/demo` and `next.config.ts` overlaid, so it remains compatible with the existing production database.

The standalone package was preflighted locally and on server loopback port `3211`, then activated on port `3210`. The public page and all five GIF resources returned HTTP 200, the new copy was present in the rendered HTML, and the root VibeBoard route remained available. `vibeboard.service`, Gateway and nginx container PIDs stayed unchanged. No database migration, nginx change or non-VibeHard service restart was performed. The temporary preview process and uploaded archive were removed after verification. Package SHA-256: `af03d41661a59e1c1779312e9eafcfa24a18a7daf3538991e565d9e7e22f90da`.

### PCB preview restoration, 2026-09-16

The September 9 and 10 Demo-only builds omitted the PCB overlay previously published on September 5, reverting `/vibehard/app/pcb` to the old preview. This release restores the detailed TH-NODE v0.2 example with assembly/routing views, copper and silkscreen visibility, zoom/pan and PNG export. This remains an example preview; it does not add EDA generation or production Gerber export.

The build uses baseline `96c4991` with the full current overlay: `app/demo`, `public/demo`, `next.config.ts`, `app/app/pcb` and `components/pcb`. Preserve this full list in subsequent visual releases. The source snapshot, `RELEASE.json`, verification script, activation script and previous systemd unit are retained in `/opt/vibehard/releases/20260916-pcb-restore/`. No database migration was required.

Six existing PCB/Demo tests and the production build passed. `scripts/verify-frontend-release.mjs` passed against the local standalone, server preview, active service and public domain. It verifies a short-lived fictional user's PCB page render, the detailed drawing code in the assets actually referenced by that page, the unauthenticated redirect/API guard, and all five GIF hashes. The Demo's rendered body markup also matched production before and after the switch. VibeBoard, Gateway and nginx process IDs remained unchanged. The temporary preview service was stopped after verification.

Standalone archive SHA-256: `be09c5520e5e347b839cc948ea554a4adcc82f8b533d3ea43ce4a40ebd459bdd`. Source archive SHA-256: `fd5d98212b89c72bafea4c17dc5c55d1db6b4d3be2285ee40ea195fafb365cb8`.

On the server, verify the active release without exposing credentials:

```bash
node --env-file=/etc/vibehard/platform.env \
  /opt/vibehard/releases/20260916-pcb-restore/verify-frontend-release.mjs \
  https://ldcx.tech /opt/vibehard/releases/20260916-pcb-restore/standalone
```

## Route ownership

- `/` and `/api`: existing VibeBoard/WebHUD. VibeHard deployments must not modify these routes or `vibeboard.service`.
- `/vibehard/`: VibeHard Next.js standalone on host port `3210`.
- `/vibehard/runner`: authenticated Runner WebSocket Gateway on host Docker bridge address `172.17.0.1:8787`.
- `/zutils/`: existing VibeHard static compatibility route.

The nginx container bind-mounts a single configuration file read-only. A host-side edit that replaces the file inode is not visible after `nginx -s reload`; restart the nginx container once to remount it, after `nginx -t` succeeds.

### SSH access from the development Mac

The deploy key `/Users/hushaohong/.ssh/ldcx_vibeboard_deploy` is passphrase-protected. The passphrase is stored in the developer Mac's macOS Keychain and SSH loads it automatically when `-o UseKeychain=yes` is passed to `ssh`/`scp`. Do not ask the user for the passphrase; if reloading is needed, run `ssh-add --apple-use-keychain /Users/hushaohong/.ssh/ldcx_vibeboard_deploy`.

## Runtime layout

```text
/opt/vibehard/releases/<release>/standalone  Next.js standalone
/opt/vibehard/releases/<release>/services    Gateway, Runner and migration bundles
/opt/vibehard/releases/<release>/drizzle     SQL migrations
/etc/vibehard/platform.env                   root-owned secrets, mode 600
```

PostgreSQL, active workspaces, Codex sessions and service code stay on block storage. OSS is appropriate for training datasets, uploads, firmware, reports, archived artifacts and backups. Do not mount OSS as the live database or Agent workspace.

## Build

```bash
NEXT_PUBLIC_BASE_PATH=/vibehard pnpm build
pnpm build:services
```

Copy `.next/standalone`, `.next/static`, `public`, `dist/services` and `drizzle` into a versioned release. Run `services/migrate.cjs` with `DATABASE_URL` before switching the systemd working directory.

The current source requires migration `0002`, which adds Runner instance identity, structured approval details, the model provider/model uniqueness constraint and the Runner command foreign key. Back up PostgreSQL, run the migration bundle once, and only then switch the `current` symlink.

On Linux, a production Runner must set `RUNNER_CODEX_WRAPPER` to a strong workspace isolation command. `RUNNER_ALLOW_WEAK_ISOLATION=true` is a development-only escape hatch and must not be present in the production environment.

## Safety and rollback

1. Keep the previous release and systemd unit.
2. Verify the new Gateway locally before changing nginx.
3. Run `nginx -t` before reload or restart.
4. Confirm the root WebHUD response and `vibeboard.service` PID are unchanged.
5. To roll back, restore the previous `vibehard.service`, run `systemctl daemon-reload`, and restart only `vibehard.service`. Restore the nginx backup only if the Gateway route itself caused the failure.

Provider API keys and Runner shared secrets must never be committed. A Runner on a developer machine may connect outbound to production, but it is available only while that machine is online. A permanent server Runner requires a separately installed and authenticated Codex CLI.
