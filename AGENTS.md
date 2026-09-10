<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deployment notes (production)

- Deployment host: `root@47.102.197.71`; VibeHard base path: `/vibehard`.
- SSH key: `/Users/hushaohong/.ssh/ldcx_vibeboard_deploy` is passphrase-protected.
- On this development Mac the passphrase is stored in the macOS Keychain. Use `-o UseKeychain=yes` on `ssh`/`scp` so it unlocks automatically.
- Do not ask the user for the passphrase. If a prompt still appears, run `ssh-add --apple-use-keychain /Users/hushaohong/.ssh/ldcx_vibeboard_deploy`.
- Do not restart `vibeboard.service`, the nginx container, or the Gateway unless the task explicitly requires it.
