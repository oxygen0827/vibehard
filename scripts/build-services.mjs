import { mkdir } from "node:fs/promises";
import { build } from "esbuild";

const entries = {
  gateway: "gateway/index.ts",
  runner: "runner/index.ts",
  migrate: "scripts/migrate.ts",
  "llm-bootstrap": "scripts/bootstrap-llm-settings.ts",
};

await mkdir("dist/services", { recursive: true });

await Promise.all(Object.entries(entries).map(([name, entry]) => build({
  entryPoints: [entry],
  outfile: `dist/services/${name}.cjs`,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: true,
  minify: false,
  logLevel: "info",
})));
