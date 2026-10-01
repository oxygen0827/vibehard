import { NextResponse, type NextRequest } from "next/server";
import { badRequest, isResourceId, requestUser, unauthorized } from "@/lib/server/http";
import { archiveDeviceReport } from "@/lib/server/project-documents";
import { deviceReportSchema } from "@/lib/device/device-report";
import { projectFilePath } from "@/lib/agent/project-document";
import { LlmRequestError } from "@/lib/server/llm-client";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
const limit = 16384;
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  const { id } = await context.params;
  if (!isResourceId(id)) return badRequest("项目 ID 无效");
  const origin = request.headers.get("origin");
  // Next standalone's request.url may use its internal listener, not the browser's public origin.
  // A fixed deployment origin avoids trusting client-provided Host/forwarded headers.
  const expectedOrigin = process.env.VIBEHARD_PUBLIC_ORIGIN ?? (process.env.NODE_ENV !== "production" ? new URL(request.url).origin : null);
  if (!expectedOrigin) return NextResponse.json({ error: "设备归档外部地址尚未配置，请管理员检查发布配置" }, { status: 503 });
  if (origin && origin !== expectedOrigin || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "不允许跨站提交设备报告" }, { status: 403 });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) return badRequest("请使用 JSON 设备报告");
  if (!consumeRateLimit("device-report", user.id, 10, 60_000).allowed) return NextResponse.json({ error: "归档过于频繁，请稍后重试" }, { status: 429 });
  try {
    if (Number(request.headers.get("content-length")) > limit) throw new LlmRequestError("报告超过 16 KiB 限制", 413);
    const reader = request.body?.getReader(); if (!reader) return badRequest("缺少设备报告");
    const chunks: Uint8Array[] = []; let size = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new LlmRequestError("报告上传超时，请重试归档", 408)), 5000); });
    try {
      for (;;) {
        const { done, value } = await Promise.race([reader.read(), deadline]); if (done) break;
        size += value.byteLength;
        if (size > limit) throw new LlmRequestError("报告超过 16 KiB 限制", 413);
        chunks.push(value);
      }
    } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock(); }
    const parsed = deviceReportSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) return badRequest("设备报告格式或 RV1126B 身份数据无效");
    const saved = await archiveDeviceReport(user.id, id, parsed.data);
    return NextResponse.json({ document: { id: saved.file.documentId, projectId: id, kind: saved.file.kind,
      path: projectFilePath(saved.file), sha256: saved.file.sha256 }, created: saved.created },
      { status: saved.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequest("报告 JSON 格式无效");
    if (error instanceof LlmRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "诊断报告未归档，数据库暂不可用。可用同一采集编号手动重试" }, { status: 503 });
  }
}
