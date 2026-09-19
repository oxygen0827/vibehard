import { type NextRequest, NextResponse } from "next/server";
import { authenticateRunner, runnerOwnsActiveTask } from "@/lib/server/store";
import { runtimeLlm } from "@/lib/server/llm-settings";
import { llmError } from "@/lib/server/llm-http";
import { isResourceId } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const runnerKey = request.headers.get("x-runner-key") ?? "";
  const taskId = request.nextUrl.searchParams.get("taskId") ?? "";
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  try {
    // Cloud credentials must never be distributed to registered end-user USB nodes.
    if (runnerKey !== "cloud-runner" || !isResourceId(taskId) || !await authenticateRunner(runnerKey, secret) || !await runnerOwnsActiveTask(runnerKey, taskId)) return NextResponse.json({ error: "执行器或任务授权无效" }, { status: 403 });
    const config = await runtimeLlm("agent");
    if (!config) return NextResponse.json({ error: "尚未配置 Agent 模型" }, { status: 503 });
    return NextResponse.json({ config }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return llmError(error); }
}
