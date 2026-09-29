// DeepSeek's hosted web search supplies links; these are leads, not verified chip specifications.
import { runtimeLlm } from "@/lib/server/llm-settings";
export type ChipWebResult = {
  title: string;
  url: string;
  host: string;
  description: string;
  kind: "产品页" | "数据手册" | "参考手册" | "SDK / 工具" | "原理图" | "其他资料";
  source: "厂商域名" | "其他来源";
};

export class ChipWebSearchError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

const vendorDomains = [
  "espressif.com", "st.com", "nxp.com", "ti.com", "microchip.com", "nordicsemi.com",
  "rock-chips.com", "wch.cn", "gd32mcu.com", "renesas.com", "infineon.com", "onsemi.com", "analog.com",
];

function kindOf(text: string): ChipWebResult["kind"] {
  if (/datasheet|data.sheet|数据手册/i.test(text)) return "数据手册";
  if (/reference.manual|technical.reference|参考手册|技术手册/i.test(text)) return "参考手册";
  if (/schematic|原理图|参考设计/i.test(text)) return "原理图";
  if (/\bsdk\b|software|firmware|programming|tool|例程|开发包|烧录/i.test(text)) return "SDK / 工具";
  if (/product|产品|overview|概览/i.test(text)) return "产品页";
  return "其他资料";
}

type WebSearchResult = { type?: unknown; title?: unknown; url?: unknown; snippet?: unknown };
type DeepSeekResponse = { content?: { type?: string; content?: WebSearchResult[] }[] };

function mentionsModel(text: string, model: string) {
  const lower = text.toLocaleLowerCase();
  const needle = model.toLocaleLowerCase();
  let from = 0;
  while ((from = lower.indexOf(needle, from)) !== -1) {
    if (!/[a-z0-9]/.test(lower[from - 1] ?? "") && !/[a-z0-9]/.test(lower[from + needle.length] ?? "")) return true;
    from += needle.length;
  }
  return false;
}

export function normalizeChipWebResults(response: DeepSeekResponse, model: string): ChipWebResult[] {
  const seen = new Set<string>();
  const results: ChipWebResult[] = [];
  for (const block of response.content ?? []) for (const item of block.type === "web_search_tool_result" && Array.isArray(block.content) ? block.content : []) {
    if (item.type !== "web_search_result") continue;
    if (typeof item.url !== "string" || typeof item.title !== "string") continue;
    let url: URL;
    try { url = new URL(item.url); } catch { continue; }
    if (url.protocol !== "https:" || url.username || url.password || seen.has(url.href)) continue;
    const description = typeof item.snippet === "string" ? item.snippet : "";
    const searchable = `${item.title} ${url.pathname} ${description}`;
    if (!mentionsModel(searchable, model)) continue;
    seen.add(url.href);
    const host = url.hostname.toLocaleLowerCase();
    results.push({
      title: item.title.slice(0, 180), url: url.href, host, description: description.slice(0, 350),
      kind: kindOf(searchable),
      source: vendorDomains.some(domain => host === domain || host.endsWith(`.${domain}`)) ? "厂商域名" : "其他来源",
    });
  }
  return results.sort((a, b) => Number(b.source === "厂商域名") - Number(a.source === "厂商域名")).slice(0, 15);
}

export async function searchChipWeb(model: string, signal?: AbortSignal): Promise<ChipWebResult[]> {
  const config = await runtimeLlm("design");
  if (!config || new URL(config.baseUrl).hostname !== "api.deepseek.com")
    throw new ChipWebSearchError("请先在管理页配置 DeepSeek 方案模型", 503);
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "deepseek-flash", max_tokens: 1024,
        system: "Use hosted web search to find chip development resources. Search for the exact model, official product page, datasheet/reference manual, and SDK or tools. Do not invent links.",
        messages: [{ role: "user", content: `Find web sources for chip model ${model}.` }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      }),
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    });
  } catch {
    throw new ChipWebSearchError("DeepSeek 云端搜索连接失败或超时，请稍后重试");
  }
  if (!response.ok) throw new ChipWebSearchError(response.status === 429 ? "DeepSeek 搜索请求过于频繁，请稍后重试" : "DeepSeek 云端搜索暂时不可用", response.status === 429 ? 429 : 502);
  let data: DeepSeekResponse;
  try { data = await response.json() as DeepSeekResponse; }
  catch { throw new ChipWebSearchError("DeepSeek 搜索响应格式不正确"); }
  if (!data.content?.some(block => block.type === "web_search_tool_result"))
    throw new ChipWebSearchError("DeepSeek 未返回网页搜索结果，请稍后重试");
  return normalizeChipWebResults(data, model);
}
