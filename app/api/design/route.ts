import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { designResultSchema } from "@/lib/agent/llm";
import { requestUser, unauthorized, badRequest } from "@/lib/server/http";
import { runtimeLlm } from "@/lib/server/llm-settings";
import { callLlm, LlmRequestError } from "@/lib/server/llm-client";
import { llmError } from "@/lib/server/llm-http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { HARDWARE_DESIGN_KNOWLEDGE, hardwareDesignSystemPrompt } from "@/lib/agent/hardware-design-knowledge";

const system = hardwareDesignSystemPrompt();
export async function POST(request: NextRequest) {
  const user = await requestUser(request); if (!user) return unauthorized();
  if (!consumeRateLimit("design", user.id, 5, 60_000).allowed) return NextResponse.json({ error: "生成过于频繁，请稍后重试" }, { status: 429 });
  try {
    const input = z.object({ requirement: z.string().trim().min(2).max(12_000) }).safeParse(await request.json());
    if (!input.success) return badRequest("请输入 2–12000 字的需求");
    const config = await runtimeLlm("design");
    if (!config) return NextResponse.json({ error: "尚未配置方案生成模型，请管理员在平台管理中设置" }, { status: 503 });
    const controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const stream = new ReadableStream({
      start(output) {
        const encoder = new TextEncoder(); let closed = false;
        const send = (data: unknown) => { if (!closed) output.enqueue(encoder.encode(JSON.stringify(data) + "\n")); };
        send({ type: "status", message: "已加载内置方案知识库，正在等待模型生成", model: config.model });
        const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000);
        void (async () => {
          try {
            const text = await callLlm(config, system, input.data.requirement, signal);
            let raw;
            try { raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); } catch { throw new LlmRequestError("模型返回的方案格式不正确，请重新生成"); }
            const result = designResultSchema.safeParse(raw);
            if (!result.success) throw new LlmRequestError("模型返回的方案字段不完整，请重新生成");
            send({ type: "result", result: result.data, model: config.model, generatedAt: new Date().toISOString(), knowledgeBase: { id: HARDWARE_DESIGN_KNOWLEDGE.id, version: HARDWARE_DESIGN_KNOWLEDGE.version } });
          } catch (error) { send({ type: "error", error: error instanceof LlmRequestError ? error.message : "方案生成失败，请重试" }); }
          finally { clearInterval(heartbeat); if (!closed) { closed = true; output.close(); } }
        })();
        signal.addEventListener("abort", () => { clearInterval(heartbeat); if (!closed) { closed = true; output.close(); } }, { once: true });
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) { return llmError(error); }
}
