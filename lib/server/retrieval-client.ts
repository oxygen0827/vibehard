import { request } from "node:http";
import { z } from "zod";
import type { RetrievalSource } from "@/lib/agent/knowledge-retrieval";
const source = z.object({ scope: z.literal("platform"), id: z.uuid(), reviewStatus: z.literal("auto-indexed"), version: z.object({
  title: z.string().max(1000), source: z.string().max(2000), content: z.string().max(1800), kind: z.enum(["manual", "schematic", "product", "sdk"]),
  version: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/), reviewedBy: z.string().max(100), reviewedAt: z.string().max(100),
}) });
const reply = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), sources: z.array(source).max(12) });
// No fetch URL from the caller: private Unix socket only, never an HTTP browser route.
async function privateRequest(path: string, body: string, signal?: AbortSignal) {
  const socketPath = process.env.VIBEHARD_RETRIEVAL_SOCKET;
  if (!socketPath || !socketPath.startsWith("/")) throw new Error("Private index unavailable");
  const payload = await new Promise<string>((resolve, reject) => {
    const req = request({ socketPath, path, method: "POST", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(1500)]) : AbortSignal.timeout(1500),
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, res => {
      const chunks: Buffer[] = []; let bytes = 0;
      res.on("data", (part: Buffer) => { bytes += part.length; if (bytes > 128000) req.destroy(new Error("Index response limit")); else chunks.push(part); });
      res.on("end", () => res.statusCode === 200 ? resolve(Buffer.concat(chunks).toString("utf8")) : reject(new Error("Private index unavailable")));
      res.on("error", reject);
    });
    req.on("error", () => reject(new Error("Private index unavailable"))); req.end(body);
  });
  return JSON.parse(payload) as unknown;
}
export async function queryPrivateIndex(query: string, signal?: AbortSignal): Promise<{ revision: string; sources: RetrievalSource[] }> {
  return reply.parse(await privateRequest("/query", JSON.stringify({ query: query.slice(0, 12000) }), signal));
}
// Checks activation/revocation policy without opening SQLite or doing FTS.
export async function privateIndexRevision(signal?: AbortSignal): Promise<string> {
  return reply.pick({ revision: true }).parse(await privateRequest("/revision", "{}", signal)).revision;
}
