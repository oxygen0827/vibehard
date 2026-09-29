import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isKnowledgeReviewer } from "@/lib/agent/knowledge";
import { badRequest, forbidden, requestUser, unauthorized } from "@/lib/server/http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { ChipWebSearchError, searchChipWeb } from "@/lib/server/chip-resource-search";

export const runtime = "nodejs";
const input = z.object({ model: z.string().trim().min(2).max(80).regex(/^[\p{L}\p{N}][\p{L}\p{N}._+ /()-]*$/u) }).strict();

export async function POST(request: NextRequest) {
  const user = await requestUser(request); if (!user) return unauthorized();
  if (!isKnowledgeReviewer(user.role)) return forbidden("仅管理员和开发者可以检索芯片资料");
  const reader = request.body?.getReader();
  if (!reader) return badRequest("请输入芯片型号");
  const chunks: Uint8Array[] = []; let bytes = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 512) { await reader.cancel(); return badRequest("芯片型号过长"); }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  let body: unknown;
  try { body = JSON.parse(text); } catch { return badRequest("请输入有效的芯片型号"); }
  const parsed = input.safeParse(body);
  if (!parsed.success) return badRequest("请输入 2–80 字的芯片型号");
  if (!consumeRateLimit("chip-web-search", user.id, 3, 60_000).allowed) return NextResponse.json({ error: "搜索过于频繁，请稍后重试" }, { status: 429 });
  try {
    const results = await searchChipWeb(parsed.data.model, request.signal);
    return NextResponse.json({ model: parsed.data.model, results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const known = error instanceof ChipWebSearchError ? error : new ChipWebSearchError("全网搜索服务暂时不可用");
    return NextResponse.json({ error: known.message }, { status: known.status, headers: { "Cache-Control": "no-store" } });
  }
}
