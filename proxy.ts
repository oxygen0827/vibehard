import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, readSessionToken } from "@/lib/server/security";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(readSessionToken(request.cookies.get(AUTH_COOKIE)?.value));

  // 未登录访问工作台 → 重定向到登录页
  if (!hasSession) {
    // new URL 不会自动带 basePath，子路径部署（如 /vibehard）时需手动补前缀
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const loginUrl = new URL(`${basePath}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
