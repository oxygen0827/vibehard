import { NextResponse, type NextRequest } from "next/server";
import { llmInput } from "@/lib/agent/llm";
import { badRequest } from "@/lib/server/http";
import { llmAdmin, llmError } from "@/lib/server/llm-http";
import { publicLlm, saveLlm } from "@/lib/server/llm-settings";
import { providerAddress } from "@/lib/server/llm-client";

export async function GET(request: NextRequest) {
  const auth = await llmAdmin(request); if (auth.response) return auth.response;
  try { return NextResponse.json({ settings: await Promise.all([publicLlm("design"), publicLlm("agent")]) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return llmError(error); }
}
export async function PUT(request: NextRequest) {
  const auth = await llmAdmin(request); if (auth.response) return auth.response;
  try {
    const parsed = llmInput.safeParse(await request.json());
    if (!parsed.success) return badRequest("请检查模型配置；Agent 必须使用 Responses 协议");
    await providerAddress(parsed.data.baseUrl);
    return NextResponse.json({ setting: await saveLlm(parsed.data, auth.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return llmError(error); }
}
