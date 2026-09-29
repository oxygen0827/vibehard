// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/schematic/route";
import { POST as submit, GET as knowledge } from "@/app/api/projects/[id]/knowledge/route";
import { callLlm, llmRequestBody, LlmRequestError } from "@/lib/server/llm-client";
import { readSchematicUpload } from "@/lib/server/schematic-upload";
import { schematicImages, SCHEMATIC_PDF_PAGE_LIMIT } from "@/lib/server/schematic-pdf";
import { createProject, createUser } from "@/lib/server/store";
import { createSessionToken } from "@/lib/server/security";
import { saveLlm } from "@/lib/server/llm-settings";
import { schematicResultSchema, SCHEMATIC_FILE_LIMIT, SCHEMATIC_DRAFT_NOTICE, SCHEMATIC_MARKDOWN_LIMIT } from "@/lib/agent/schematic";
import { changeKnowledge, publishedSnapshot } from "@/lib/server/knowledge-state";
import type { RuntimeLlm } from "@/lib/agent/llm";
import { createCanvas, loadImage } from "@napi-rs/canvas";

vi.mock("@/lib/server/llm-client", async original => ({ ...await original<typeof import("@/lib/server/llm-client")>(), callLlm: vi.fn(), providerAddress: vi.fn().mockResolvedValue({ address: "8.8.8.8", family: 4 }) }));
function pdfBytes(pageCount = 1) {
  const fontId = pageCount + 3;
  const pageIds = Array.from({ length: pageCount }, (_, index) => index + 3);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...pageIds.map((_, index) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${fontId + 1 + index} 0 R >>`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ...pageIds.map((_, index) => {
      const content = `0 0 0 rg 72 700 100 12 re f BT /F1 20 Tf 72 720 Td (PAGE ${index + 1} U1) Tj ET`;
      return `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;
    }),
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const startxref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(body + `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${startxref}\n%%EOF\n`);
}
const pdf = new File([pdfBytes()], "board.pdf", { type: "application/pdf" });
const modelReply = JSON.stringify({ title: "板卡资料", markdown: "## 引脚与证据\n第 1 页 U1 引脚文字无法辨认。\n## 待确认项\n需清晰原图，不声称已验证。" });
beforeEach(() => { globalThis.__vibehardLlmSettings?.clear(); globalThis.__vibehardSchematicActive?.clear(); vi.mocked(callLlm).mockReset(); });
async function fixture(configured = true) {
  const user = await createUser({ email: `${crypto.randomUUID()}@example.invalid`, passwordHash: "test", inviteCode: "test" });
  if (configured) await saveLlm({ purpose: "design", baseUrl: "https://example.com/v1", model: "vision-test", protocol: "responses", apiKey: "test-api-key", revision: null }, user.id);
  return { user, cookie: `vibehard_session=${createSessionToken(user)}` };
}
function upload(cookie = "", file = pdf) {
  const form = new FormData(); form.set("file", file);
  return new NextRequest("https://example.com/api/schematic", { method: "POST", headers: { Cookie: cookie }, body: form });
}
describe("schematic upload and protocol", () => {
  it("sends actual PDF/image bytes with the configured protocol and leaves text-only calls unchanged", () => {
    const config: RuntimeLlm = { model: "existing-model", protocol: "responses", baseUrl: "https://example.com/v1", apiKey: "secret", revision: "r" };
    const file = { filename: "board.pdf", mimeType: "application/pdf" as const, base64: "JVBERi0=" };
    expect(llmRequestBody(config, "rules", "task", file)).toMatchObject({ model: "existing-model", store: false, input: [{ content: [{ text: "task" }, { type: "input_file", filename: "board.pdf", file_data: "data:application/pdf;base64,JVBERi0=" }] }] });
    expect(llmRequestBody({ ...config, protocol: "chat-completions" }, "rules", "task", file)).toMatchObject({ messages: [{ content: "rules" }, { content: [{ text: "task" }, { type: "file", file: { filename: "board.pdf" } }] }] });
    const image = { ...file, filename: "board.png", mimeType: "image/png" as const };
    expect(JSON.stringify(llmRequestBody(config, "rules", "task", image))).toContain('"type":"input_image"');
    expect(JSON.stringify(llmRequestBody({ ...config, protocol: "chat-completions" }, "rules", "task", image))).toContain('"type":"image_url"');
    expect(llmRequestBody(config, "rules", "task")).toMatchObject({ input: "task" });
  });
  it("bounds streamed upload bytes and rejects incorrect extensions/signatures", async () => {
    const valid = await readSchematicUpload(upload());
    expect(valid.attachment.base64).toBe(Buffer.from(await pdf.arrayBuffer()).toString("base64"));
    expect(valid.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(readSchematicUpload(upload("", new File(["not an image"], "a.png", { type: "image/png" })))).rejects.toThrow("一致");
    await expect(readSchematicUpload(upload("", new File(["%PDF-1.4"], "a.png", { type: "image/png" })))).rejects.toThrow("一致");
    const bytes = new Uint8Array(SCHEMATIC_FILE_LIMIT + 40_000);
    const request = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test" }, body: bytes });
    await expect(readSchematicUpload(request)).rejects.toThrow("5 MB");
  });
  it("renders every PDF page to a real image and sends ordered page evidence", async () => {
    const attachment = { filename: "board.pdf", mimeType: "application/pdf" as const, base64: pdfBytes(2).toString("base64") };
    const images = await schematicImages(attachment);
    expect(images.map(image => image.filename)).toEqual(["board.pdf-第1页.png", "board.pdf-第2页.png"]);
    for (const image of images) {
      expect(image.mimeType).toBe("image/png");
      expect(Buffer.from(image.base64, "base64").subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
    const rendered = await loadImage(Buffer.from(images[0].base64, "base64"));
    const canvas = createCanvas(rendered.width, rendered.height);
    const context = canvas.getContext("2d");
    context.drawImage(rendered, 0, 0);
    expect([...context.getImageData(160, 170, 1, 1).data].slice(0, 3)).toEqual([0, 0, 0]);
    const config: RuntimeLlm = { model: "deepseek-flash", protocol: "responses", baseUrl: "https://api.deepseek.com", apiKey: "fixture", revision: "r" };
    const body = JSON.stringify(llmRequestBody(config, "rules", "task", images));
    expect(body).toContain('"type":"input_image"');
    expect(body).toContain("附件第 1 页");
    expect(body).toContain("附件第 2 页");
    expect(body).not.toContain('"type":"input_file"');
    const chatBody = JSON.stringify(llmRequestBody({ ...config, protocol: "chat-completions" }, "rules", "task", images));
    expect(chatBody).toContain('"type":"image_url"');
    expect(chatBody).not.toContain('"type":"file"');
    await expect(schematicImages({ ...attachment, base64: pdfBytes(SCHEMATIC_PDF_PAGE_LIMIT + 1).toString("base64") })).rejects.toThrow("拆分");
    await expect(schematicImages({ ...attachment, base64: Buffer.from("%PDF-invalid").toString("base64") })).rejects.toThrow("无法解析");
  });
});
describe("real schematic route contracts (upstream mocked)", () => {
  it("requires authentication/config and returns no fixed circuit fallback", async () => {
    expect((await POST(upload())).status).toBe(401);
    const { cookie } = await fixture(false);
    expect((await POST(upload(cookie))).status).toBe(503);
    expect(callLlm).not.toHaveBeenCalled();
  });
  it("produces provenance and saves only an owner-scoped pending draft, with idempotent retries", async () => {
    const { user, cookie } = await fixture();
    vi.mocked(callLlm).mockResolvedValue(modelReply);
    const stream = await (await POST(upload(cookie))).text();
    const event = stream.trim().split("\n").map(line => JSON.parse(line)).find(event => event.type === "result");
    const result = schematicResultSchema.parse(event.result);
    expect(result.draft.source).toContain(result.fileSha256);
    expect(result.draft.content).toContain("未经工程师审核");
    expect(callLlm).toHaveBeenCalledWith(expect.objectContaining({ model: "vision-test" }), expect.stringContaining("不使用固定示例"), expect.stringContaining("第 1 页"), expect.any(AbortSignal), 90_000, [expect.objectContaining({ mimeType: "image/png", filename: "board.pdf-第1页.png", base64: expect.any(String) })]);
    const images = vi.mocked(callLlm).mock.calls[0][5] as { base64: string }[];
    expect(Buffer.from(images[0].base64, "base64").subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const project = await createProject(user.id, { name: "原理图申请", workspaceKey: crypto.randomUUID() });
    const context = { params: Promise.resolve({ id: project.id }) };
    const action = { action: "create", submissionId: result.analysisId, draft: result.draft };
    const request = () => new NextRequest("http://localhost/api/knowledge", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(action) });
    const saved = await (await submit(request(), context)).json();
    expect(saved.documents).toHaveLength(1); expect(saved.publishedCount).toBe(0);
    expect((await (await submit(request(), context)).json()).documents).toHaveLength(1);
    const outsider = await fixture(false);
    expect((await knowledge(new NextRequest("http://localhost", { headers: { Cookie: outsider.cookie } }), context)).status).toBe(403);
    const foreign = new NextRequest("http://localhost/api/knowledge", { method: "POST", headers: { Cookie: outsider.cookie, "Content-Type": "application/json" }, body: JSON.stringify(action) });
    expect((await submit(foreign, context)).status).toBe(403);
  });
  it("preserves a 5590-character recognition that fits the knowledge draft, including its final evidence", async () => {
    const { user, cookie } = await fixture();
    const markdown = "## 引脚与证据\n".padEnd(5560, "可见网络；") + "\n## 待确认项\n末尾证据必须保留。";
    const capturedLength = markdown.padEnd(5590, "。");
    expect(capturedLength).toHaveLength(5590);
    vi.mocked(callLlm).mockResolvedValue(JSON.stringify({ title: "合成长度回归", markdown: capturedLength }));
    const events = (await (await POST(upload(cookie))).text()).trim().split("\n").map(line => JSON.parse(line));
    expect(events.find(event => event.type === "error")).toBeUndefined();
    const result = schematicResultSchema.parse(events.find(event => event.type === "result")?.result);
    expect(result.draft.content.endsWith(capturedLength)).toBe(true);
    expect(result.draft.content.length).toBeLessThanOrEqual(6000);
    const project = await createProject(user.id, { name: "长度回归", workspaceKey: crypto.randomUUID() });
    const response = await submit(new NextRequest("http://localhost/api/knowledge", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", submissionId: result.analysisId, draft: result.draft }) }), { params: Promise.resolve({ id: project.id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).documents[0].draft.content).toBe(result.draft.content);
  });
  it("accepts the exact draft capacity and reports the actual count one character beyond it", async () => {
    const { cookie } = await fixture();
    const markdown = "可".repeat(SCHEMATIC_MARKDOWN_LIMIT);
    vi.mocked(callLlm).mockResolvedValue(JSON.stringify({ title: "边界回归", markdown }));
    const accepted = (await (await POST(upload(cookie))).text()).trim().split("\n").map(line => JSON.parse(line)).find(event => event.type === "result");
    const result = schematicResultSchema.parse(accepted?.result);
    expect(result.draft.content).toBe(SCHEMATIC_DRAFT_NOTICE + markdown);
    expect(result.draft.content).toHaveLength(6000);
    vi.mocked(callLlm).mockResolvedValue(JSON.stringify({ title: "边界回归", markdown: markdown + "可" }));
    const rejected = await (await POST(upload(cookie))).text();
    expect(rejected).toContain(`正文为 ${SCHEMATIC_MARKDOWN_LIMIT + 1} 个字符`);
    expect(rejected).toContain(`${SCHEMATIC_MARKDOWN_LIMIT} 字符上限`);
    expect(rejected).not.toContain('"type":"result"');
  });
  it.each([
    [{ title: "短正文", markdown: "空" }, "不足 20 个字符"],
    [{ title: "错类型", markdown: { section: "正文" } }, "识别字段格式不正确"],
    [{ markdown: "可".repeat(30) }, "标题缺失"],
  ])("reports the output validation failure without mislabeling it as a PDF problem", async (reply, message) => {
    const { cookie } = await fixture();
    vi.mocked(callLlm).mockResolvedValue(JSON.stringify(reply));
    const text = await (await POST(upload(cookie))).text();
    expect(text).toContain(message);
    expect(text).not.toContain("请拆分图纸");
    expect(text).not.toContain('"type":"result"');
  });
  it("does not overwrite subsequent edits/publications when a submission is retried", () => {
    const owner = crypto.randomUUID();
    const action = { action: "create" as const, submissionId: crypto.randomUUID(), draft: { title: "pins", content: "U1 待确认", source: "board.pdf", kind: "schematic" as const } };
    let docs = changeKnowledge([], action, owner);
    docs = changeKnowledge(docs, { action: "edit", documentId: docs[0].id, expectedRevision: docs[0].revision, draft: { ...action.draft, content: "engineer correction" } }, owner);
    docs = changeKnowledge(docs, { action: "publish", documentId: docs[0].id, expectedRevision: docs[0].revision, confirmed: true }, owner);
    expect(changeKnowledge(docs, action, owner)).toEqual(docs);
    expect(publishedSnapshot(docs).documents[0].content).toBe("engineer correction");
    expect(() => changeKnowledge(docs, { ...action, draft: { ...action.draft, content: "different" } }, owner)).toThrow("申请编号");
  });
  it("surfaces upstream failures, invalid output, and unsupported files without a result", async () => {
    const { cookie } = await fixture();
    vi.mocked(callLlm).mockRejectedValue(new LlmRequestError("模型不支持图片"));
    let text = await (await POST(upload(cookie))).text();
    expect(text).toContain("模型不支持图片"); expect(text).not.toContain('"type":"result"');
    vi.mocked(callLlm).mockResolvedValue("not JSON");
    text = await (await POST(upload(cookie))).text();
    expect(text).toContain("格式不正确"); expect(text).not.toContain('"type":"result"');
    expect((await POST(upload(cookie, new File(["<svg/>"], "bad.svg")))).status).toBe(400);
    expect(globalThis.__vibehardSchematicActive?.size).toBe(0);
  });
  it("does not offer a pending draft when the model reports an unreadable document", async () => {
    const { cookie } = await fixture();
    vi.mocked(callLlm).mockResolvedValue(JSON.stringify({ title: "附件不可读", markdown: "## 分析范围\n[Unsupported Document]，文件内容无法读取，未能提取任何原理图信息。" }));
    const text = await (await POST(upload(cookie))).text();
    expect(text).toContain("模型未能读取图纸内容");
    expect(text).not.toContain('"type":"result"');
  });
  it("rejects concurrent work and releases the slot on cancellation", async () => {
    const { cookie } = await fixture();
    vi.mocked(callLlm).mockImplementation((_c, _s, _p, signal) => new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new LlmRequestError("取消")), { once: true })));
    const response = await POST(upload(cookie));
    expect((await POST(upload(cookie))).status).toBe(429);
    await response.body!.cancel();
    await vi.waitFor(() => expect(globalThis.__vibehardSchematicActive?.size).toBe(0));
  });
});
