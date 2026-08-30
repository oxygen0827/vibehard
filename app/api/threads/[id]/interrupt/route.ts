import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { interruptLatestTurn } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  try { const { id } = await context.params; if (!isResourceId(id)) return badRequest("会话 ID 无效"); const interrupted = await interruptLatestTurn(user.id, id); if (interrupted === null) return forbidden(); return NextResponse.json({ interrupted }); } catch (error) { return serverError(error); }
}
