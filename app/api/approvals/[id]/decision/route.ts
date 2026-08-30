import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { decideApproval } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";

const schema = z.object({ decision: z.enum(["approve", "reject"]) });
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  try { const parsed = schema.safeParse(await request.json()); if (!parsed.success) return badRequest("审批决定无效"); const { id } = await context.params; if (!isResourceId(id)) return badRequest("审批 ID 无效"); const approval = await decideApproval(user.id, id, parsed.data.decision); return approval ? NextResponse.json({ approval }) : forbidden("审批不存在、已处理或不属于当前用户"); } catch (error) { return serverError(error); }
}
