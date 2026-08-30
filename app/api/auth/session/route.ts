import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestUser } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const user = await requestUser(request);
  return NextResponse.json({ authenticated: Boolean(user), user }, { headers: { "Cache-Control": "no-store" } });
}
