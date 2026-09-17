import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ownedProject } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";
import { DownloadError, projectArchive } from "@/lib/server/project-download";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!isResourceId(id)) return badRequest("项目 ID 无效");
  try {
    const project = await ownedProject(user.id, id);
    if (!project) return forbidden();
    const root = process.env.ARTIFACT_WORKSPACE_ROOT;
    if (!root || project.runnerKey !== process.env.ARTIFACT_RUNNER_KEY) {
      return NextResponse.json({ error: "该项目尚未启用云端工程下载" }, { status: 409 });
    }
    const archive = await projectArchive(root, project.workspaceKey);
    return new Response(new Uint8Array(archive).buffer, { headers: {
      "Content-Type": "application/zip", "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="vibehard-${id}.zip"`,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof DownloadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return NextResponse.json({ error: "工程尚未生成" }, { status: 404 });
    if ((error as NodeJS.ErrnoException).code === "ELOOP") return badRequest("工程包含不安全的链接");
    return serverError(error);
  }
}
