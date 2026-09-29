import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateRunner } from "@/lib/server/store";
import { acknowledgeRunnerDesign, pendingRunnerDesigns } from "@/lib/server/design-artifacts";
import { isResourceId } from "@/lib/server/http";

async function authorizedRunner(request: NextRequest) {
  const key = request.headers.get("x-runner-key") ?? "";
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return key === "cloud-runner" && await authenticateRunner(key, secret) ? key : null;
}
const forbidden = () => NextResponse.json({ error: "执行器授权无效" }, { status: 403 });
const unavailable = () => NextResponse.json({ error: "方案文件同步暂时不可用" }, { status: 503 });
export async function GET(request: NextRequest) {
  try {
    const runner = await authorizedRunner(request); if (!runner) return forbidden();
    const after = request.nextUrl.searchParams.get("after") ?? undefined;
    if (after && !isResourceId(after)) return NextResponse.json({ error: "分页参数无效" }, { status: 400 });
    return NextResponse.json(await pendingRunnerDesigns(runner, after), { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
const receipt = z.object({ designId: z.uuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export async function POST(request: NextRequest) {
  try {
    const runner = await authorizedRunner(request); if (!runner) return forbidden();
    const parsed = receipt.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "同步凭据无效" }, { status: 400 });
    const ok = await acknowledgeRunnerDesign(runner, parsed.data.designId, parsed.data.sha256);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}
