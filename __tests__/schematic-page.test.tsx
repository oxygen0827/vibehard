import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SchematicPage from "@/app/app/schematic/page";
import { ProjectKnowledge } from "@/components/app/project-knowledge";
import { changeKnowledge } from "@/lib/server/knowledge-state";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });
const projectId = "c8932037-d7f4-46ba-8ddf-31c68d831326";
const result = { analysisId: "86552575-9015-4d5c-a071-dda5c0edce1e", model: "vision", generatedAt: "2026-09-19T13:00:00.000Z", fileName: "board.png", fileSha256: "a".repeat(64), archive: { projectId, documentId: "86552575-9015-4d5c-a071-dda5c0edce1e", path: "documents/schematic-test.md" }, draft: { title: "原理图引脚", source: "board.png SHA256", kind: "schematic", content: "## 待确认\nU1 引脚不清晰 <script>bad()</script>" } };
const json = (data: unknown, ok = true) => ({ ok, json: async () => data });
function stream(event: unknown) { return { ok: true, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n")); c.close(); } }) }; }
async function analyze() {
  fireEvent.change(screen.getByLabelText("上传原理图"), { target: { files: [new File(["fixture"], "board.png", { type: "image/png" })] } });
  expect(screen.getByRole("button", { name: "开始识别" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "开始识别" })).toBeDisabled();
  await screen.findByRole("option", { name: "泰山派" });
  fireEvent.change(screen.getByLabelText("当前项目"), { target: { value: projectId } });
  // Processing consent must be confirmed for the newly selected destination.
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "开始识别" }));
}
describe("schematic candidate UI", () => {
  it("shows focused upload and document panels without creating a model request", async () => {
    const fetcher = vi.fn(async () => json({ projects: [{ id: projectId, name: "泰山派" }] }));
    vi.stubGlobal("fetch", fetcher);
    render(<SchematicPage />);
    await screen.findByRole("option", { name: "泰山派" });
    expect(screen.getByRole("region", { name: "图纸上传" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "识别结果" })).toHaveTextContent("选择项目并上传图纸后");
    expect(screen.getByText("图纸要求与处理说明").closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByRole("button", { name: "申请加入知识库备选" })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("supports a single dragged file and removing it clears consent and disables recognition", async () => {
    const fetcher = vi.fn(async () => json({ projects: [{ id: projectId, name: "泰山派" }] }));
    vi.stubGlobal("fetch", fetcher);
    render(<SchematicPage />);
    await screen.findByRole("option", { name: "泰山派" });
    fireEvent.change(screen.getByLabelText("当前项目"), { target: { value: projectId } });
    const dropZone = screen.getByRole("button", { name: /点击选择文件/ }).parentElement!;
    fireEvent.drop(dropZone, { dataTransfer: { files: [new File(["fixture"], "board.pdf", { type: "application/pdf" })] } });
    expect(screen.getByText("board.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "开始识别" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "移除图纸" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "开始识别" })).toBeDisabled();
    fireEvent.drop(dropZone, { dataTransfer: { files: [new File(["a"], "a.pdf"), new File(["b"], "b.pdf")] } });
    expect(screen.getByRole("alert")).toHaveTextContent("请每次上传一份图纸");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("shows safe structured document text and retains the untouched Markdown view", async () => {
    const content = "## 接口与引脚\n| 器件 | 管脚 |\n| --- | --- |\n| U1 | `GPIO3` |\n- **待确认**：电平\n<img src=x onerror=alert(1)>\n[伪造链接](javascript:alert(1))";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/api/projects") ? json({ projects: [{ id: projectId, name: "泰山派" }] }) : stream({ type: "result", result: { ...result, draft: { ...result.draft, content } } })));
    const { container } = render(<SchematicPage />);
    await analyze();
    await screen.findByRole("button", { name: "Markdown 原文" });
    expect(screen.getByRole("heading", { name: "接口与引脚" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("GPIO3");
    expect(container.querySelector("img,script")).toBeNull();
    expect(screen.queryByRole("link", { name: "伪造链接" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Markdown 原文" }));
    expect(screen.getByLabelText("识别文档阅读区域").textContent).toBe(content);
    expect(screen.getByRole("button", { name: "Markdown 原文" })).toHaveAttribute("aria-pressed", "true");
  });
  it("locks project/file controls while identifying and cancellation creates no candidate", async () => {
    const fetcher = vi.fn((url: string, init?: RequestInit) => url.endsWith("/api/projects") ? Promise.resolve(json({ projects: [{ id: projectId, name: "泰山派" }] })) : new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
    vi.stubGlobal("fetch", fetcher);
    render(<SchematicPage />); await analyze();
    await screen.findByRole("button", { name: "取消识别" });
    expect(screen.getByLabelText("当前项目")).toBeDisabled();
    expect(screen.getByLabelText("上传原理图")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("region", { name: "识别结果" })).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "取消识别" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("已取消识别");
    expect(screen.queryByRole("button", { name: "申请加入知识库备选" })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("requires target selection, submits only a draft, retries safely and links to that review document", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/projects")) return json({ projects: [{ id: projectId, name: "泰山派" }] });
      if (url.endsWith("/api/schematic")) return stream({ type: "result", result });
      if (init?.method === "POST") { if (++attempts === 1) throw new Error("网络中断"); return json({ documents: [{ id: result.analysisId }], publishedCount: 0 }); }
      throw new Error("unexpected request");
    });
    vi.stubGlobal("fetch", fetcher);
    const { container } = render(<SchematicPage />);
    await analyze();
    const button = await screen.findByRole("button", { name: "申请加入知识库备选" });
    expect(button).toBeEnabled(); expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/已自动归档到当前项目/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到项目并交给 Agent →" })).toHaveAttribute("href", `/app/agent?project=${projectId}`);
    const uploadCall = fetcher.mock.calls.find(([url]) => url.endsWith("/api/schematic"))!;
    expect((uploadCall[1]!.body as FormData).get("projectId")).toBe(projectId);
    fireEvent.click(button); await screen.findByRole("alert");
    fireEvent.click(button);
    const link = await screen.findByRole("link", { name: "查看申请与审核状态 →" });
    expect(link).toHaveAttribute("href", `/app/agent/${projectId}/knowledge?document=${result.analysisId}`);
    const writes = fetcher.mock.calls.filter(([, init]) => init?.headers);
    expect(writes).toHaveLength(2);
    for (const [url, init] of writes) {
      expect(url).toContain(`/api/projects/${projectId}/knowledge`);
      expect(JSON.parse(String(init!.body))).toEqual({ action: "create", submissionId: result.analysisId, draft: result.draft });
    }
    expect(screen.queryByRole("button", { name: "审核并发布" })).toBeNull();
    expect(screen.getByRole("button", { name: "已加入备选" })).toBeDisabled();
  });
  it("does not offer candidate submission when recognition fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/api/projects") ? json({ projects: [{ id: projectId, name: "泰山派" }] }) : stream({ type: "error", error: "模型服务不可用" })));
    render(<SchematicPage />); await analyze();
    expect(await screen.findByRole("alert")).toHaveTextContent("模型服务不可用");
    expect(screen.queryByRole("button", { name: "申请加入知识库备选" })).toBeNull();
  });
  it("direct status link selects the candidate without giving the submitting owner review rights", async () => {
    const docs = changeKnowledge([], { action: "create", submissionId: result.analysisId, draft: { ...result.draft, kind: "schematic" } }, crypto.randomUUID());
    vi.stubGlobal("fetch", vi.fn(async () => json({ documents: docs, projectName: "泰山派", permissions: { canEdit: true, canReview: false } })));
    render(<ProjectKnowledge projectId={projectId} initialDocumentId={result.analysisId} />);
    await waitFor(() => expect(screen.getByLabelText("资料标题")).toHaveValue("原理图引脚"));
    expect(screen.queryByRole("button", { name: "审核并发布" })).toBeNull();
    expect(docs[0].publishedVersion).toBeNull();
  });
});
