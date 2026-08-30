import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { registerRunner } from "@/lib/server/store";
import { badRequest, serverError } from "@/lib/server/http";

const schema = z.object({ runnerKey: z.string().regex(/^[a-zA-Z0-9._-]{2,80}$/), name: z.string().min(2).max(100), capabilities: z.array(z.string()).max(50) });
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.RUNNER_REGISTRATION_TOKEN || token !== process.env.RUNNER_REGISTRATION_TOKEN) return NextResponse.json({ error: "Runner 注册令牌无效" }, { status: 401 });
  try { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return badRequest("Runner 注册信息无效", parsed.error.flatten().fieldErrors); const result = await registerRunner(parsed.data); return NextResponse.json({ ...result, gatewayUrl: process.env.RUNNER_GATEWAY_URL ?? "ws://127.0.0.1:8787/runner" }, { status: 201 }); } catch (error) { return serverError(error); }
}
