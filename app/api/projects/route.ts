import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, listProjects, RunnerUnavailableError } from "@/lib/server/store";
import { badRequest, requestUser, serverError, unauthorized } from "@/lib/server/http";

const schema = z.object({ name: z.string().trim().min(2).max(80), workspaceKey: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/), model: z.string().optional(), runnerKey: z.string().regex(/^[a-zA-Z0-9._-]{2,80}$/).optional() });

export async function GET(request: NextRequest) {
  const user = await requestUser(request);
  if (!user) return unauthorized();
  try { return NextResponse.json({ projects: await listProjects(user.id) }); } catch (error) { return serverError(error); }
}

export async function POST(request: NextRequest) {
  const user = await requestUser(request);
  if (!user) return unauthorized();
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest("项目名称或工作区标识格式不正确", parsed.error.flatten().fieldErrors);
    return NextResponse.json({ project: await createProject(user.id, parsed.data) }, { status: 201 });
  } catch (error) { return error instanceof RunnerUnavailableError ? badRequest(error.message) : serverError(error); }
}
