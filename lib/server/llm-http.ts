import { NextResponse, type NextRequest } from "next/server";
import { requestUser, unauthorized, forbidden } from "./http";
import { LlmConfigError, LlmConflictError } from "./llm-settings";
import { LlmRequestError } from "./llm-client";

export async function llmAdmin(request: NextRequest) {
  const user = await requestUser(request);
  if (!user) return { response: unauthorized() };
  if (user.role !== "admin") return { response: forbidden("仅管理员可以配置模型") };
  if (request.method !== "GET" && !request.headers.get("content-type")?.startsWith("application/json")) return { response: forbidden("只接受 JSON 请求") };
  return { user };
}
export function llmError(error: unknown) {
  // Never log raw provider responses, credentials or DB parameters.
  const status = error instanceof LlmConflictError ? 409 : error instanceof LlmConfigError ? 400 : error instanceof LlmRequestError ? error.status : 500;
  return NextResponse.json({ error: error instanceof LlmConfigError || error instanceof LlmRequestError ? error.message : "模型服务暂时不可用，请检查服务配置" }, { status, headers: { "Cache-Control": "no-store" } });
}
