import { afterEach, expect, it, vi } from "vitest";
import { ChipWebSearchError, normalizeChipWebResults, searchChipWeb } from "@/lib/server/chip-resource-search";
import { runtimeLlm } from "@/lib/server/llm-settings";

vi.mock("@/lib/server/llm-settings", () => ({ runtimeLlm: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("keeps model-matching HTTPS links, deduplicates them and prioritizes known vendor domains", () => {
  const results = normalizeChipWebResults({ content: [{ type: "web_search_tool_result", content: [
    { type: "web_search_result", title: "RV1106 board notes", url: "https://community.example/rv1106", snippet: "RV1106" },
    { type: "web_search_result", title: "RV1106 Datasheet", url: "https://www.rock-chips.com/rv1106.pdf", snippet: "RV1106 data" },
    { type: "web_search_result", title: "RV1106 Datasheet duplicate", url: "https://www.rock-chips.com/rv1106.pdf" },
    { type: "web_search_result", title: "RV1126 Datasheet", url: "https://www.rock-chips.com/rv1126.pdf" },
    { type: "web_search_result", title: "RV1106B Datasheet", url: "https://www.rock-chips.com/rv1106b.pdf" },
    { type: "web_search_result", title: "RV1106 unsafe", url: "javascript:alert(1)" },
    { type: "web_search_result", title: "RV1106 spoof", url: "https://rock-chips.com.evil.example/rv1106" },
  ] }] }, "RV1106");
  expect(results.map(item => item.title)).toEqual(["RV1106 Datasheet", "RV1106 board notes", "RV1106 spoof"]);
  expect(results.map(item => item.source)).toEqual(["厂商域名", "其他来源", "其他来源"]);
});

it("uses the saved DeepSeek key and hosted web search results", async () => {
  vi.mocked(runtimeLlm).mockResolvedValue({ baseUrl: "https://api.deepseek.com", model: "deepseek-flash", protocol: "responses", apiKey: "test-key", revision: "test" });
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ content: [{ type: "web_search_tool_result", content: [] }] }));
  vi.stubGlobal("fetch", fetcher);
  expect(await searchChipWeb("RV1106")).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("https://api.deepseek.com/anthropic/v1/messages");
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("x-api-key")).toBe("test-key");
  const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
  expect(body.model).toBe("deepseek-flash");
  expect(body.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 3 }]);
});

it("reports missing DeepSeek settings without claiming an empty web result", async () => {
  vi.mocked(runtimeLlm).mockResolvedValue(null);
  await expect(searchChipWeb("RV1106")).rejects.toMatchObject({ status: 503 } satisfies Partial<ChipWebSearchError>);
});
