import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listAvailableRunners } from "@/lib/server/store";
import { requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const user = await requestUser(request);
  if (!user) return unauthorized();
  try { return NextResponse.json({ runners: await listAvailableRunners() }); }
  catch (error) { return serverError(error); }
}
