import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createThread, listThreads } from "@/lib/server/store";
import { badRequest, forbidden, requestUser, serverError, unauthorized } from "@/lib/server/http";

const schema = z.object({ title: z.string().trim().max(120).optional() });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = requestUser(request); if (!user) return unauthorized();
  try { const { id } = await context.params; const threads = await listThreads(user.id, id); return threads ? NextResponse.json({ threads }) : forbidden(); } catch (error) { return serverError(error); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = requestUser(request); if (!user) return unauthorized();
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return badRequest("会话标题格式不正确");
    const { id } = await context.params; const thread = await createThread(user.id, id, parsed.data.title); return thread ? NextResponse.json({ thread }, { status: 201 }) : forbidden();
  } catch (error) { return serverError(error); }
}
