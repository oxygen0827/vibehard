import { afterEach, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPortableStandalone } from "../scripts/standalone-links.mjs";
const roots: string[] = [];
const create = () => { const root = mkdtempSync(join(tmpdir(), "standalone-link-test-")); roots.push(root); mkdirSync(join(root, "node_modules/next"), { recursive: true }); writeFileSync(join(root, "node_modules/next/package.json"), "{}"); return root; };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it("accepts only self-contained relative runtime links", () => {
  const root = create(); symlinkSync("next", join(root, "node_modules/alias")); expect(() => assertPortableStandalone(root)).not.toThrow();
});
it("rejects a shadowing PDF directory containing only the traced worker", () => {
  const root = create(); mkdirSync(join(root, "node_modules/pdfjs-dist/legacy/build"), { recursive: true });
  writeFileSync(join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"), "export {};");
  expect(() => assertPortableStandalone(root, { requirePdf: true })).toThrow(/Missing standalone PDF runtime/);
  writeFileSync(join(root, "node_modules/pdfjs-dist/legacy/build/pdf.mjs"), "export {};");
  writeFileSync(join(root, "node_modules/pdfjs-dist/package.json"), '{"name":"pdfjs-dist","version":"6.3.289"}');
  expect(() => assertPortableStandalone(root, { requirePdf: true })).not.toThrow();
});
it("rejects an absolute shared dependency directory before packaging", () => {
  const root = mkdtempSync(join(tmpdir(), "standalone-link-test-")); roots.push(root);
  const outside = create(); symlinkSync(join(outside, "node_modules"), join(root, "node_modules"));
  expect(() => assertPortableStandalone(root)).toThrow(/Absolute dependency link/);
});
it("rejects relative escape and dangling links", () => {
  const root = create(); symlinkSync("../../outside", join(root, "node_modules/escape")); expect(() => assertPortableStandalone(root)).toThrow(/Escaping dependency link/);
  rmSync(join(root, "node_modules/escape")); symlinkSync("missing", join(root, "node_modules/missing")); expect(() => assertPortableStandalone(root)).toThrow(/Dangling dependency link/);
});
