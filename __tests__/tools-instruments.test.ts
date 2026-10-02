import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const instruments = [
  ["oscilloscope", "oscilloscope-learning-lab.html"],
  ["multimeter", "multimeter-learning-lab.html"],
  ["waveform-generator", "arbitrary-waveform-generator-lab.html"],
];

it.each(instruments)("loads %s lab in initial export and hydrated client under any base path", (slug, lab) => {
  const html = readFileSync(`public/zutils/tools/${slug}/index.html`, "utf8");
  const src = html.match(/<iframe[^>]*src="([^"]+)"/)![1];
  for (const prefix of ["", "/vibehard"]) {
    const resolved = new URL(src, `https://example.test${prefix}/zutils/tools/${slug}/index.html`);
    expect(resolved.pathname).toBe(`${prefix}/zutils/labs/${lab}`);
  }
  expect(existsSync(`public/zutils/labs/${lab}`)).toBe(true);
  const entry = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]).find(p => p.includes("/app/tools/"))!;
  const url = new URL(entry, `https://example.test/zutils/tools/${slug}/index.html`);
  const client = readFileSync(`public${decodeURIComponent(url.pathname)}`, "utf8");
  expect(client).toContain(`src:"../../labs/${lab}"`);
  expect(client).not.toMatch(/src:"\/labs\//);
  const original = readFileSync("public/zutils/_next/static/chunks/app/tools/[slug]/page-a2fa6d866e173302.js", "utf8");
  expect(client.replaceAll('src:"../../labs/', 'src:"/labs/')).toBe(original);
  expect(entry).not.toContain("page-a2fa6d866e173302.js");
});
