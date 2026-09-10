import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, forbidden, requestUser, serverError, unauthorized } from "@/lib/server/http";
import { findUserById, resetUserPassword, writeAuditLog } from "@/lib/server/store";
import { hashPassword } from "@/lib/server/security";

const schema = z.object({ password: z.string().min(8, "密码至少需要 8 位").max(256) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== "admin") return forbidden("仅管理员可以重置用户密码");
  try {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("密码不符合要求", parsed.error.flatten().fieldErrors);
    const target = await findUserById(id);
    if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    const updated = await resetUserPassword(id, await hashPassword(parsed.data.password));
    if (!updated) return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    await writeAuditLog({ userId: admin.id, action: "user.password_reset", metadata: { targetUserId: target.id, targetEmail: target.email } });
    return NextResponse.json({ ok: true, user: { id: target.id, email: target.email } });
  } catch (error) {
    return serverError(error);
  }
}
