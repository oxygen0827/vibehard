import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("packages and deploys only the three schematic UI files over the active complete frontend", () => {
  for (const kind of ["package", "deploy"]) {
    const source = readFileSync(`scripts/${kind}-schematic-workspace-ui.mjs`, "utf8");
    expect(source).toContain("20261002-schematic-workspace-ui-v1");
    expect(source).toContain("20261001-device-workspace-ui-v1");
    expect(source).toContain("['app/app/schematic/page.tsx','components/app/schematic-document.tsx','lib/module-help.ts']");
    expect(source).toContain("Published source missing");
    expect(source).toContain("assertPortableStandalone");
  }
});

it("retains candidate, protected services, readable backup and rollback without backend changes", () => {
  const source = readFileSync("scripts/deploy-schematic-workspace-ui.mjs", "utf8");
  for (const guard of ["port=3217", "manifest.migration,null", "<SchematicDocument", "dangerouslySetInnerHTML", "protectedBefore", "pg_dump", "pg_restore", "await restore()", "verify('https://ldcx.tech')", "Cloud heartbeat stale", "Missing live Gateway connections"])
    expect(source).toContain(guard);
  expect(source).not.toMatch(/db:migrate|systemctl.*restart.*vibehard-runner/);
});
