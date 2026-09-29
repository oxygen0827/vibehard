// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { DesignFileSync } from "./design-sync";
import { designArtifactPath } from "@/lib/agent/design-artifact";

it("acknowledges only files actually written, advances past failures, and wraps for backfill", async () => {
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "vibehard-design-sync-")));
  const markdown = "# Saved design";
  const good = { projectId: randomUUID(), designId: randomUUID(), markdown, sha256: createHash("sha256").update(markdown).digest("hex") };
  const bad = { ...good, designId: randomUUID(), sha256: "a".repeat(64) };
  const requests: Array<{ url: string; method?: string }> = [];
  let pages = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options: RequestInit) => {
    requests.push({ url, method: options.method });
    expect((options.headers as Record<string, string>)["X-Runner-Key"]).toBe("cloud-runner");
    if (options.method === "POST") {
      expect(JSON.parse(options.body as string)).toEqual({ designId: good.designId, sha256: good.sha256 });
      expect(await readFile(path.join(workspace, designArtifactPath(good)), "utf8")).toBe(markdown);
      return Response.json({ ok: true });
    }
    return Response.json(pages++ === 0 ? { items: [{ workspaceKey: "fixture", artifact: good }, { workspaceKey: "fixture", artifact: bad }], next: bad.designId } : { items: [], next: null });
  }));
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    const sync = new DesignFileSync("https://example.invalid/vibehard", "cloud-runner", "fixture", async () => workspace);
    await sync.poll(); await sync.poll(); await sync.poll();
    expect(requests.filter(item => item.method === "POST")).toHaveLength(1);
    expect(requests[2].url).toContain(`after=${bad.designId}`);
    expect(requests[3].url).not.toContain("after=");
    expect(log).toHaveBeenCalledWith("design file sync failed", bad.designId);
  } finally { vi.unstubAllGlobals(); log.mockRestore(); await rm(workspace, { recursive: true, force: true }); }
});
