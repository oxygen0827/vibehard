import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, readSessionToken } from "./security";
export function requestUser(request: NextRequest) { return readSessionToken(request.cookies.get(AUTH_COOKIE)?.value); }
export function unauthorized(message = "请先登录") { return NextResponse.json({ error: message }, { status: 401 }); }
export function forbidden(message = "无权访问该资源") { return NextResponse.json({ error: message }, { status: 403 }); }
export function badRequest(message: string, details?: unknown) { return NextResponse.json({ error: message, details }, { status: 400 }); }
export function serverError(error: unknown) { console.error(error); return NextResponse.json({ error: "服务暂时不可用" }, { status: 500 }); }
