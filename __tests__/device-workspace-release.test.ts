import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("packages and deploys the same scoped frontend-only release over the active UI baseline", () => {
  for (const name of ["package", "deploy"]) {
    const source = readFileSync(`scripts/${name}-device-workspace-ui.mjs`, "utf8");
    expect(source).toContain("20261001-device-workspace-ui-v1");
    expect(source).toContain("20261001-project-archive-ui-v4");
    expect(source).toContain("['components/app/agent-workbench.tsx','components/app/browser-device-panel.tsx','components/app/device-workspace.tsx','lib/module-help.ts']");
    expect(source).not.toContain("20261001-browser-device-report-v1");
    expect(source).toContain("assertPortableStandalone");
  }
});

it("retains candidate, backup, protected-service and rollback gates without a migration", () => {
  const source = readFileSync("scripts/deploy-device-workspace-ui.mjs", "utf8");
  for (const guard of ["port=3217", "manifest.migration,null", "if (mode !==", "<BrowserDevicePanel compact", "protectedBefore", "pg_dump", "pg_restore", "await restore()", "verify('https://ldcx.tech')", "Cloud heartbeat stale", "Missing live Gateway connections"])
    expect(source).toContain(guard);
  expect(source).not.toMatch(/db:migrate|systemctl.*restart.*vibehard-runner/);
});
