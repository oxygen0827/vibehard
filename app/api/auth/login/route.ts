import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/server/store";
import { AUTH_COOKIE, createSessionToken, hashPassword, verifyPassword } from "@/lib/server/security";
import { badRequest, serverError } from "@/lib/server/http";

const schema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(8) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("邮箱或密码格式不正确", parsed.error.flatten().fieldErrors);
    let user = await findUserByEmail(parsed.data.email);
    if (!user && process.env.NODE_ENV !== "production" && parsed.data.email === "demo@vibehard.ai" && parsed.data.password === "demo1234") {
      user = await createUser({ email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password), inviteCode: "DEMO", name: "Demo 用户" });
    }
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    const sessionUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const response = NextResponse.json({ user: sessionUser });
    response.cookies.set(AUTH_COOKIE, createSessionToken(sessionUser), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return serverError(error);
  }
}
