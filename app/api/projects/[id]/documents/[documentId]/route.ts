import { NextResponse, type NextRequest } from "next/server";
import { badRequest, isResourceId, requestUser, unauthorized } from "@/lib/server/http";
import { archivedFile, readProjectDocument } from "@/lib/server/project-documents";
import { getProjectOriginal, ProjectDownloadBusy } from "@/lib/server/project-document-storage";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string; documentId: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  const { id, documentId } = await context.params;
  if (!isResourceId(id) || !isResourceId(documentId)) return badRequest("资料 ID 无效");
  const format = request.nextUrl.searchParams.get("format") ?? "markdown";
  if (!["markdown", "source"].includes(format)) return badRequest("下载格式无效");
  if (!consumeRateLimit("document-download", user.id, 20, 60_000).allowed) return NextResponse.json({ error: "下载过于频繁，请稍后重试" }, { status: 429 });
  try {
    const doc = await readProjectDocument(user.id, id, documentId);
    if (!doc) return NextResponse.json({ error: "资料不存在或无权访问" }, { status: 404 });
    if (format === "source" ? !doc.originalStored : !doc.result) return NextResponse.json({ error: "这份资料尚未保存完成" }, { status: 409 });
    const source = format === "source";
    const bytes = source ? await getProjectOriginal(doc.objectKey, doc.fileSha256, doc.byteSize) : Buffer.from(archivedFile(doc).markdown);
    const name = source ? doc.fileName : `${archivedFile(doc).kind}-${doc.id}.md`;
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox",
    } });
  } catch (error) {
    if (error instanceof ProjectDownloadBusy) return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": "5" } });
    return NextResponse.json({ error: "资料读取或完整性校验失败，请稍后重试" }, { status: 503 });
  }
}
