import { z } from "zod";
import { designArtifactSchema } from "@/lib/agent/design-artifact";
import { materializeDesign } from "./design-files";

const pageSchema = z.object({ items: z.array(z.object({ workspaceKey: z.string().min(1).max(500), artifact: designArtifactSchema })).max(2), next: z.uuid().nullable(), failed: z.array(z.uuid()).max(2).default([]) });
export class DesignFileSync {
  private busy = false;
  private after: string | null = null;
  constructor(private readonly platform: string, private readonly runnerKey: string, private readonly secret: string,
    private readonly workspaceFor: (key: string) => Promise<string>) {}

  async poll() {
    if (this.busy) return;
    this.busy = true;
    const headers = { Authorization: `Bearer ${this.secret}`, "X-Runner-Key": this.runnerKey, "Content-Type": "application/json" };
    const endpoint = `${this.platform}/api/runners/design-artifacts`;
    const signal = AbortSignal.timeout(12000);
    try {
      const response = await fetch(`${endpoint}${this.after ? `?after=${this.after}` : ""}`, { headers, signal, redirect: "error" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = pageSchema.parse(await response.json());
      for (const id of page.failed) console.error("design file source unavailable", id);
      for (const { artifact, workspaceKey } of page.items) {
        try {
          await materializeDesign(await this.workspaceFor(workspaceKey), artifact, artifact.projectId);
          const receipt = await fetch(endpoint, { method: "POST", headers, signal, redirect: "error",
            body: JSON.stringify({ designId: artifact.designId, sha256: artifact.sha256 }) });
          if (!receipt.ok) throw new Error(`HTTP ${receipt.status}`);
        } catch {
          // Advance past a failed source so one file cannot starve newer designs.
          console.error("design file sync failed", artifact.designId);
        }
      }
      this.after = page.next;
    } catch { console.error("design file sync unavailable"); }
    finally { this.busy = false; }
  }
}
