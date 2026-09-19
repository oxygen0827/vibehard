import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeSessionCookies } from "@/lib/server/session-cookies";
import { requestUser } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const user = await requestUser(request);
  const response = NextResponse.json({ ok: true });
  writeSessionCookies(response, null);
  if (user) await writeAuditLog({ userId: user.id, action: "auth.logout" });
  return response;
}
