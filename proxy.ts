import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(AUTH_COOKIE);

  // 未登录访问工作台 → 重定向到登录页
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
