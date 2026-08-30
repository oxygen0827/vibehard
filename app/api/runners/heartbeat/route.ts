import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { heartbeatRunner } from "@/lib/server/store";
import { badRequest, serverError } from "@/lib/server/http";

const schema = z.object({ runnerKey: z.string(), capabilities: z.array(z.string()).optional() });
export async function POST(request: NextRequest) {
  try { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return badRequest("心跳格式无效"); const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; return (await heartbeatRunner(parsed.data.runnerKey, secret, parsed.data.capabilities)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Runner 凭据无效" }, { status: 401 }); } catch (error) { return serverError(error); }
}
