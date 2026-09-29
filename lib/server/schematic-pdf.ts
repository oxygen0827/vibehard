import { join, sep } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { LlmRequestError, type LlmAttachment } from "./llm-client";

export const SCHEMATIC_PDF_PAGE_LIMIT = 6;
const MAX_PAGE_PIXELS = 4_000_000;
const MAX_PAGE_EDGE = 2800;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 16 * 1024 * 1024;
const PDF_RENDER_TIMEOUT_MS = 15_000;

const pdfjsRoot = join(process.cwd(), "node_modules", "pdfjs-dist");

export async function schematicImages(attachment: LlmAttachment, signal?: AbortSignal): Promise<LlmAttachment[]> {
  if (attachment.mimeType !== "application/pdf") return [attachment];
  const timeout = AbortSignal.timeout(PDF_RENDER_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const checkAbort = () => {
    if (combined.aborted) throw new LlmRequestError(signal?.aborted ? "请求已取消" : "PDF 转图片超时，请拆分图纸后重试", 504);
  };
  checkAbort();
  const loadingTask = getDocument({
    data: new Uint8Array(Buffer.from(attachment.base64, "base64")),
    standardFontDataUrl: join(pdfjsRoot, "standard_fonts") + sep,
    cMapUrl: join(pdfjsRoot, "cmaps") + sep,
    cMapPacked: true,
    wasmUrl: join(pdfjsRoot, "wasm") + sep,
    stopAtErrors: true,
  });
  const abortLoading = () => { void loadingTask.destroy(); };
  combined.addEventListener("abort", abortLoading, { once: true });
  try {
    const pdf = await loadingTask.promise;
    checkAbort();
    if (pdf.numPages < 1) throw new LlmRequestError("PDF 没有可识别的页面", 400);
    if (pdf.numPages > SCHEMATIC_PDF_PAGE_LIMIT) throw new LlmRequestError(`PDF 最多支持 ${SCHEMATIC_PDF_PAGE_LIMIT} 页，请拆分后上传`, 400);
    const images: LlmAttachment[] = [];
    let totalBytes = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      checkAbort();
      const page = await pdf.getPage(pageNumber);
      try {
        const original = page.getViewport({ scale: 1 });
        if (!Number.isFinite(original.width * original.height) || original.width <= 0 || original.height <= 0) throw new LlmRequestError(`PDF 第 ${pageNumber} 页尺寸无效`, 400);
        const scale = Math.min(2, Math.sqrt(MAX_PAGE_PIXELS / (original.width * original.height)), MAX_PAGE_EDGE / Math.max(original.width, original.height));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const render = page.render({ canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement, background: "rgb(255,255,255)" });
        const cancelRender = () => render.cancel();
        combined.addEventListener("abort", cancelRender, { once: true });
        try { await render.promise; }
        finally { combined.removeEventListener("abort", cancelRender); }
        checkAbort();
        let bytes = await canvas.encode("png");
        let mimeType: "image/png" | "image/jpeg" = "image/png";
        if (bytes.length > MAX_IMAGE_BYTES) {
          bytes = await canvas.encode("jpeg", 95);
          mimeType = "image/jpeg";
        }
        totalBytes += bytes.length;
        if (bytes.length > MAX_IMAGE_BYTES || totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new LlmRequestError("PDF 转换后的图片过大，请拆分或压缩图纸后重试", 413);
        images.push({ filename: `${attachment.filename}-第${pageNumber}页.${mimeType === "image/png" ? "png" : "jpg"}`, mimeType, base64: bytes.toString("base64") });
      } finally { page.cleanup(); }
    }
    return images;
  } catch (error) {
    if (error instanceof LlmRequestError) throw error;
    if (combined.aborted) checkAbort();
    throw new LlmRequestError("PDF 无法解析或渲染，请确认文件完整且未加密", 400);
  } finally {
    combined.removeEventListener("abort", abortLoading);
    await loadingTask.destroy().catch(() => {});
  }
}
