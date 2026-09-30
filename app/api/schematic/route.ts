import { NextResponse, type NextRequest } from "next/server";
import { SCHEMATIC_DRAFT_NOTICE, SCHEMATIC_MARKDOWN_LIMIT, SCHEMATIC_SYSTEM, schematicModelResultSchema, schematicResultSchema } from "@/lib/agent/schematic";
import { requestUser, unauthorized, isResourceId } from "@/lib/server/http";
import { ownedProject } from "@/lib/server/store";
import { beginProjectDocument, completeProjectDocument, failProjectDocument, markOriginalStored } from "@/lib/server/project-documents";
import { assertProjectStorageConfigured, putProjectOriginal, ProjectStorageError } from "@/lib/server/project-document-storage";
import { callLlm, LlmRequestError } from "@/lib/server/llm-client";
import { runtimeLlm } from "@/lib/server/llm-settings";
import { llmError } from "@/lib/server/llm-http";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { readSchematicUpload } from "@/lib/server/schematic-upload";
import { schematicImages } from "@/lib/server/schematic-pdf";

export const runtime = "nodejs";
declare global { var __vibehardSchematicActive: Set<string> | undefined }
const active = globalThis.__vibehardSchematicActive ??= new Set<string>();
export async function POST(request: NextRequest) {
  const user = await requestUser(request); if (!user) return unauthorized();
  if (active.has(user.id) || active.size >= 2) return NextResponse.json({ error: "已有识别任务运行，请稍后重试" }, { status: 429 });
  if (!consumeRateLimit("schematic", user.id, 3, 60_000).allowed) return NextResponse.json({ error: "识别过于频繁，请稍后重试" }, { status: 429 });
  active.add(user.id);
  let documentId: string | undefined;
  try {
    const { attachment, sha256, projectId, requestId, bytes } = await readSchematicUpload(request);
    if (typeof projectId !== "string" || !isResourceId(projectId) || typeof requestId !== "string" || !isResourceId(requestId)) throw new LlmRequestError("请先选择目标项目，识别请求编号必须有效", 400);
    if (!await ownedProject(user.id, projectId)) throw new LlmRequestError("项目不存在或无权访问", 404);
    const config = await runtimeLlm("design");
    if (!config) throw new LlmRequestError("请管理员先配置硬件方案生成模型；原理图识别暂共用此配置，要求支持图片输入", 503);
    assertProjectStorageConfigured();
    const started = await beginProjectDocument(user.id, projectId, { id: requestId, fileName: attachment.filename, sha256, mimeType: attachment.mimeType, byteSize: bytes.length });
    if (!started.created) {
      active.delete(user.id);
      if (started.document.status === "completed" && started.document.result) return new Response(JSON.stringify({ type: "result", result: started.document.result }) + "\n", { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
      throw new LlmRequestError("这次识别已有归档记录，请到项目资料查看状态；若已失败，重新选择文件可发起新的识别", 409);
    }
    documentId = started.document.id;
    const controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    let cancelled = false;
    const stream = new ReadableStream({
      start(output) {
        const encoder = new TextEncoder(); let closed = false;
        const send = (value: unknown) => { if (!closed) output.enqueue(encoder.encode(JSON.stringify(value) + "\n")); };
        const close = () => { if (!closed) { closed = true; if (!cancelled) output.close(); } };
        send({ type: "status", message: "正在归档原图；分析完成后自动保存到所选项目，不自动发布知识库" });
        const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000);
        const abort = () => { clearInterval(heartbeat); close(); };
        signal.addEventListener("abort", abort, { once: true });
        void (async () => {
          try {
            const images = await schematicImages(attachment, signal);
            signal.throwIfAborted();
            await putProjectOriginal(started.document.objectKey, bytes, sha256);
            await markOriginalStored(started.document.id);
            signal.throwIfAborted();
            send({ type: "status", message: "原图已私有归档，正在识别。完成后可在项目资料中找回文档。" });
            const pageHint = attachment.mimeType === "application/pdf" ? `上传的 PDF 已转换为 ${images.length} 张图片，按顺序对应第 1 页至第 ${images.length} 页。` : "";
            const text = await callLlm(config, SCHEMATIC_SYSTEM, `${pageHint}请分析附件原理图，按要求返回含证据位置、引脚与待确认项的 JSON 草案。`, signal, 90_000, images);
            let raw: unknown;
            try { raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
            catch { throw new LlmRequestError("模型返回格式不正确，未生成可提交资料；请重试"); }
            const parsed = schematicModelResultSchema.safeParse(raw);
            if (!parsed.success) {
              const markdown = raw && typeof raw === "object" && "markdown" in raw ? raw.markdown : undefined;
              if (typeof markdown === "string" && markdown.trim().length > SCHEMATIC_MARKDOWN_LIMIT) throw new LlmRequestError(`模型识别正文为 ${markdown.trim().length} 个字符，超过可保存的 ${SCHEMATIC_MARKDOWN_LIMIT} 字符上限；请重试或按图纸区域分别识别`);
              if (typeof markdown === "string" && markdown.trim().length < 20) throw new LlmRequestError("模型识别正文为空或不足 20 个字符，请重试");
              if (parsed.error.issues.some(issue => issue.path[0] === "title")) throw new LlmRequestError("模型返回的标题缺失、格式错误或超过 120 个字符，请重试");
              throw new LlmRequestError("模型返回的识别字段格式不正确，请重试");
            }
            if (/Unsupported Document|附件不可读|文件内容无法读取|未能提取任何原理图/i.test(`${parsed.data.title}\n${parsed.data.markdown}`)) throw new LlmRequestError("模型未能读取图纸内容，请检查文件或拆分为清晰图片后重试");
            const generatedAt = new Date().toISOString(); const analysisId = started.document.id;
            const result = schematicResultSchema.parse({ analysisId, model: config.model, generatedAt, fileName: attachment.filename, fileSha256: sha256,
              draft: { title: parsed.data.title, kind: "schematic", source: `${attachment.filename}；SHA256 ${sha256}；识别 ${generatedAt}；模型 ${config.model}；分析编号 ${analysisId}`,
                content: SCHEMATIC_DRAFT_NOTICE + parsed.data.markdown } });
            // Finish persistence even if the browser disconnected after model completion.
            send({ type: "status", message: "识别完成，正在保存项目文档…" });
            const saved = await completeProjectDocument(analysisId, result);
            send({ type: "result", result: saved });
          } catch (error) {
            const message = error instanceof LlmRequestError || error instanceof ProjectStorageError ? error.message : signal.aborted ? "识别已取消或连接中断，已上传原图可在项目资料中查看" : "识别或资料保存失败，请到项目资料检查归档状态后重试";
            await failProjectDocument(started.document.id, message).catch(() => undefined);
            send({ type: "error", error: message });
          }
          finally { active.delete(user.id); clearInterval(heartbeat); signal.removeEventListener("abort", abort); close(); }
        })();
      },
      cancel() { cancelled = true; controller.abort(); },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) {
    active.delete(user.id);
    if (documentId) await failProjectDocument(documentId, "识别未完成，请重新选择文件后重试").catch(() => undefined);
    return llmError(error instanceof LlmRequestError ? error : new LlmRequestError(error instanceof ProjectStorageError ? error.message : "识别准备或项目归档服务暂不可用；尚未调用模型，请管理员检查配置与数据库迁移", 503));
  }
}
