import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/server/store";
import { AUTH_COOKIE, createSessionToken, hashPassword } from "@/lib/server/security";
import { badRequest, serverError } from "@/lib/server/http";

const schema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(8), inviteCode: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("注册信息不完整", parsed.error.flatten().fieldErrors);
    const configuredCodes = process.env.INVITE_CODES;
    if (!configuredCodes && process.env.NODE_ENV === "production") return NextResponse.json({ error: "平台尚未配置内部邀请码" }, { status: 503 });
    const validCodes = (configuredCodes ?? "VIBE2026,DEVHARD,HARDWARE").split(",").map((code) => code.trim().toUpperCase());
    if (!validCodes.includes(parsed.data.inviteCode.trim().toUpperCase())) return badRequest("邀请码无效，请检查后重试");
    if (await findUserByEmail(parsed.data.email)) return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    const user = await createUser({ email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), inviteCode: parsed.data.inviteCode.trim().toUpperCase() });
    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const response = NextResponse.json({ user: sessionUser }, { status: 201 });
    response.cookies.set(AUTH_COOKIE, createSessionToken(sessionUser), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return serverError(error);
  }
}
