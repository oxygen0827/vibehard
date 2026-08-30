import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listModels } from "@/lib/server/store";
import { requestUser, serverError, unauthorized } from "@/lib/server/http";

export async function GET(request: NextRequest) { if (!requestUser(request)) return unauthorized(); try { return NextResponse.json({ models: await listModels() }); } catch (error) { return serverError(error); } }
