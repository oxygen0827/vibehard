import { NextResponse, type NextRequest } from "next/server";
import { getDesign } from "@/lib/server/design-job-store";
import { designMaterialPackage } from "@/lib/server/design-material-package";
import { badRequest, isResourceId, requestUser, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  const { id } = await context.params; if (!isResourceId(id)) return badRequest("方案编号无效");
  try {
    // Same ownership checks as the existing design download; URL is not authority.
    const job = await getDesign(user.id, id);
    if (!job) return NextResponse.json({ error: "方案不存在或无权访问" }, { status: 404 });
    if (job.status !== "completed" || !job.result) return NextResponse.json({ error: "方案尚未生成" }, { status: 409 });
    return new Response(new Uint8Array(designMaterialPackage(job)), { headers: {
      "Content-Type": "application/zip", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="project-materials-${id}.zip"`,
    } });
  } catch { return NextResponse.json({ error: "资料包暂时不可用，请稍后重试" }, { status: 503 }); }
}
