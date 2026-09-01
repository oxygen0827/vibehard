import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { forbidden, requestUser, serverError, unauthorized } from "@/lib/server/http";
import { getAdminOverview } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const user = await requestUser(request);
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("仅管理员可以查看平台管理台");
  try { return NextResponse.json(await getAdminOverview(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return serverError(error); }
}
