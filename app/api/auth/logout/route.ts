import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sessionCookiePath } from "@/lib/server/security";
import { requestUser } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const user = await requestUser(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  if (sessionCookiePath() !== "/") response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: sessionCookiePath(), maxAge: 0 });
  if (user) await writeAuditLog({ userId: user.id, action: "auth.logout" });
  return response;
}
