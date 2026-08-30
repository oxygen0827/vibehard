import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getThreadOverview } from "@/lib/server/store";
import { forbidden, requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = requestUser(request); if (!user) return unauthorized();
  try { const { id } = await context.params; const overview = await getThreadOverview(user.id, id); return overview ? NextResponse.json(overview) : forbidden(); } catch (error) { return serverError(error); }
}
