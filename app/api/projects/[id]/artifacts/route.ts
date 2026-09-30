import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listProjectArtifacts } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  try {
    const { id } = await context.params;
    if (!isResourceId(id)) return badRequest("项目 ID 无效");
    const artifacts = await listProjectArtifacts(user.id, id);
    return artifacts ? NextResponse.json({ artifacts }, { headers: { "Cache-Control": "private, no-store" } }) : forbidden();
  } catch (error) { return serverError(error); }
}
