import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import DatasheetsPage from "@/app/app/datasheets/page";
import type { KnowledgeDocument } from "@/lib/agent/knowledge";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function entry(id: string, title: string, publishedVersion: number | null) {
  const version = { title, source: `${title}.pdf#p1`, content: `${title} 引脚定义`, kind: "manual" as const,
    version: 1, sha256: "a".repeat(64), reviewedBy: "reviewer", reviewedAt: "2026-09-29" };
  const document: KnowledgeDocument = { id, revision: id, draft: { title, source: version.source, content: version.content, kind: "manual" },
    publishedVersion, publishedDraftRevision: null, versions: [version], updatedAt: "2026-09-29" };
  return { id, document };
}

it("searches the web only after the published knowledge has no match", async () => {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => init?.method === "POST"
    ? Response.json({ results: [{ title: "RV1106 Datasheet", url: "https://vendor.example/rv1106", host: "vendor.example",
      description: "RV1106 specifications", kind: "数据手册", source: "其他来源" }] })
    : Response.json({ entries: [] }));
  vi.stubGlobal("fetch", fetcher);
  render(<DatasheetsPage />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "RV1106" } });
  fireEvent.click(screen.getByRole("button", { name: /开始分析|搜索资料/ }));
  expect(await screen.findByRole("link", { name: /RV1106 Datasheet/ })).toHaveAttribute("href", "https://vendor.example/rv1106");
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(["/api/knowledge/shared", "/api/chips/search"]);
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ model: "RV1106" });
  expect(screen.queryByText(/esp32-s3_datasheet_en.pdf/)).not.toBeInTheDocument();
});

it("shows only sources for the searched, published part number and clears them on a new query", async () => {
  const entries = [entry("rv", "RV1106", 1), entry("rvb", "RV1106B", 1), entry("esp", "ESP32-S3", 1), entry("draft", "RV1106 draft", null)];
  const fetcher = vi.fn(async () => Response.json({ entries }));
  vi.stubGlobal("fetch", fetcher);
  render(<DatasheetsPage />);
  const input = screen.getByRole("textbox", { name: "芯片 / 传感器型号" });
  fireEvent.change(input, { target: { value: "RV1106" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索资料" }));
  await screen.findByText("RV1106.pdf#p1", { exact: false });
  expect(screen.queryByText("RV1106B.pdf#p1", { exact: false })).not.toBeInTheDocument();
  expect(screen.queryByText("ESP32-S3.pdf#p1", { exact: false })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "ESP32-S3" } });
  expect(screen.queryByText("RV1106.pdf#p1", { exact: false })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "搜索资料" }));
  await screen.findByText("ESP32-S3.pdf#p1", { exact: false });
  expect(screen.queryByText("RV1106.pdf#p1", { exact: false })).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("does not apply a stale search response after the model changes", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(value => { resolve = value; })));
  render(<DatasheetsPage />);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "RV1106" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索资料" }));
  fireEvent.change(input, { target: { value: "SHT30" } });
  resolve(Response.json({ entries: [entry("rv", "RV1106", 1)] }));
  await waitFor(() => expect(screen.queryByText("RV1106.pdf#p1", { exact: false })).not.toBeInTheDocument());
  expect(screen.queryByText(/未找到/)).not.toBeInTheDocument();
});

it("shows the search configuration failure after a knowledge miss", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
    ? Response.json({ error: "全网搜索尚未配置" }, { status: 503 })
    : Response.json({ entries: [] })));
  render(<DatasheetsPage />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "SHT30" } });
  fireEvent.click(screen.getByRole("button", { name: "搜索资料" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("全网搜索尚未配置");
  expect(screen.queryByText(/数据手册.*已生成/)).not.toBeInTheDocument();
});
