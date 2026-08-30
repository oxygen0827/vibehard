import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getThreadOverview, serializeEvent } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  try { const { id } = await context.params; if (!isResourceId(id)) return badRequest("会话 ID 无效"); const overview = await getThreadOverview(user.id, id); return overview ? NextResponse.json({ ...overview, events: overview.events.map(serializeEvent) }) : forbidden(); } catch (error) { return serverError(error); }
}
