import { NextResponse, type NextRequest } from "next/server";
import { llmInput } from "@/lib/agent/llm";
import { badRequest } from "@/lib/server/http";
import { llmAdmin, llmError } from "@/lib/server/llm-http";
import { candidateLlm } from "@/lib/server/llm-settings";
import { callLlm } from "@/lib/server/llm-client";
import { consumeRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  const auth = await llmAdmin(request); if (auth.response) return auth.response;
  if (!consumeRateLimit("llm-test", auth.user.id, 6, 60_000).allowed) return NextResponse.json({ error: "测试过于频繁，请稍后重试" }, { status: 429 });
  try {
    const parsed = llmInput.safeParse(await request.json()); if (!parsed.success) return badRequest("模型配置无效");
    const config = await candidateLlm(parsed.data);
    const start = Date.now();
    const nonce = `VIBEHARD_${crypto.randomUUID().slice(0, 8)}`;
    const reply = await callLlm(config, "Follow the user's instruction precisely.", `Reply with exactly ${nonce}`, request.signal, 40_000);
    if (!reply.includes(nonce)) return NextResponse.json({ error: "接口返回了文本，但未通过随机口令校验，请确认接口兼容性" }, { status: 502 });
    return NextResponse.json({ ok: true, model: config.model, latencyMs: Date.now() - start, message: "真实模型请求成功。此测试不执行 Agent 工具；请保存后到 Agent 工作台验证。" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return llmError(error); }
}
