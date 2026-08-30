import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { listEvents, serializeEvent } from "@/lib/server/store";
import { badRequest, forbidden, isResourceId, requestUser, serverError, unauthorized } from "@/lib/server/http";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requestUser(request); if (!user) return unauthorized();
  const { id } = await context.params;
  if (!isResourceId(id)) return badRequest("会话 ID 无效");
  const queryAfter = Number(new URL(request.url).searchParams.get("after") ?? "-1");
  const headerAfter = Number(request.headers.get("last-event-id") ?? "-1");
  const after = Math.max(Number.isFinite(queryAfter) ? queryAfter : -1, Number.isFinite(headerAfter) ? headerAfter : -1);
  if (!request.headers.get("accept")?.includes("text/event-stream")) {
    try { const events = await listEvents(user.id, id, after); return events ? NextResponse.json({ events: events.map(serializeEvent) }) : forbidden(); } catch (error) { return serverError(error); }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let cursor = after;
      const deadline = Date.now() + 25_000;
      try {
        while (!request.signal.aborted && Date.now() < deadline) {
          const events = await listEvents(user.id, id, cursor);
          if (events === null) { controller.enqueue(encoder.encode("event: error\ndata: {\"error\":\"forbidden\"}\n\n")); break; }
          for (const row of events) { const event = serializeEvent(row); cursor = Math.max(cursor, event.sequence); controller.enqueue(encoder.encode(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)); }
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
          await delay(1_000);
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : "stream failed" })}\n\n`));
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
