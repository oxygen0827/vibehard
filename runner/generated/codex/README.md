# Codex protocol snapshot

These files are the generated protocol types used directly by the Runner adapter. They were produced with:

```bash
codex app-server generate-ts --experimental --out runner/generated/codex
```

The repository keeps the small leaf-type subset imported by `runner/codex-stdio.ts`. Regenerate the complete output after every Codex CLI upgrade, update the adapter, rerun the Runner contract tests, and then retain the imported subset plus `VERSION`.
