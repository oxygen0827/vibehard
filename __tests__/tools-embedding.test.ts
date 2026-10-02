import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it("permits only local tool frames while retaining platform protections", async () => {
  const config = (await import("../next.config")).default;
  const rules = await config.headers!();
  const general = rules.find((rule) => rule.source === "/:path*")!;
  const tools = rules.find((rule) => rule.source === "/zutils/:path*")!;
  const csp = (rule: typeof general) => rule.headers.find((h) => h.key === "Content-Security-Policy")!.value;
  expect(csp(general)).toContain("frame-ancestors 'none'");
  expect(csp(tools)).toBe(csp(general).replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
  expect(tools.basePath).not.toBe(false);
  expect(tools.headers.filter((h) => h.key !== "Content-Security-Policy"))
    .toEqual(general.headers.filter((h) => h.key !== "Content-Security-Policy"));
});

it.each(["", "/vibehard"])("serves every exported tool under deployment prefix %s", async (prefix) => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", prefix); vi.resetModules();
  const { allZutilsTools } = await import("../lib/zutils-tools");
  const { existsSync } = await import("node:fs");
  expect(allZutilsTools).toHaveLength(42);
  for (const tool of allZutilsTools) {
    expect(tool.src.startsWith(`${prefix}/zutils/`)).toBe(true);
    expect(tool.src.endsWith(["oscilloscope", "multimeter", "waveform-generator"].includes(tool.slug) ? "?v=instrument-v1" : "?v=nav-v1")).toBe(true);
    const pathname = new URL(tool.src, "http://localhost").pathname.slice(prefix.length);
    expect(existsSync(`public${pathname}`)).toBe(true);
  }
});
