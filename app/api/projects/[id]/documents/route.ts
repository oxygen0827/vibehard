import { NextResponse, type NextRequest } from "next/server";
import { badRequest, isResourceId, requestUser, unauthorized } from "@/lib/server/http";
import { listProjectDocuments } from "@/lib/server/project-documents";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  const { id } = await context.params;
  if (!isResourceId(id)) return badRequest("项目 ID 无效");
  try {
    const documents = await listProjectDocuments(user.id, id);
    return NextResponse.json(documents ? { documents } : { error: "项目不存在或无权访问" }, { status: documents ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "项目资料暂不可用，请检查归档数据库" }, { status: 503 }); }
}
