import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createTurn, resolveModelProfile } from "@/lib/server/store";
import { badRequest, forbidden, requestUser, serverError, unauthorized } from "@/lib/server/http";

const schema = z.object({ input: z.string().trim().min(1).max(50_000), model: z.string().min(1), providerId: z.string().optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = requestUser(request); if (!user) return unauthorized();
  try {
    const parsed = schema.safeParse(await request.json()); if (!parsed.success) return badRequest("任务内容或模型无效", parsed.error.flatten().fieldErrors);
    const profile = await resolveModelProfile(parsed.data.model, parsed.data.providerId);
    if (!profile) return badRequest("模型未启用或 provider 不匹配");
    const { id } = await context.params; const turn = await createTurn(user.id, id, parsed.data.input, profile.model, profile.providerId); return turn ? NextResponse.json({ turn }, { status: 202 }) : forbidden();
  } catch (error) { return serverError(error); }
}
