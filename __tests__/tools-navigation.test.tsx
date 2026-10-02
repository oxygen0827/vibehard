import { readFileSync } from "node:fs";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { zutilsCategories } from "@/lib/zutils-tools";

const state = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.query),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("@/components/app/page-header", () => ({ PageHeader: () => <h1>实用工具箱</h1> }));
import ToolsPage from "@/app/app/tools/page";

beforeEach(() => { state.query = ""; state.replace.mockClear(); });
const bridgeListeners: [string, EventListenerOrEventListenerObject][] = [];
afterEach(() => {
  cleanup();
  for (const [type, listener] of bridgeListeners.splice(0)) document.removeEventListener(type, listener, true);
});

it.each(zutilsCategories)("opens only category $id from a deep link and preserves it on reload", (category) => {
  state.query = `category=${category.id}`;
  render(<ToolsPage />);
  for (const group of zutilsCategories) for (const tool of group.tools) {
    if (group.id === category.id) expect(screen.getByRole("heading", { name: tool.name })).toBeInTheDocument();
    else expect(screen.queryByRole("heading", { name: tool.name })).not.toBeInTheDocument();
  }
});

it("shows all tools for an unknown category and writes category selection into the URL", () => {
  state.query = "category=unknown&keep=value";
  render(<ToolsPage />);
  expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(42);
  fireEvent.click(screen.getByRole("button", { name: "硬件 / PCB" }));
  expect(state.replace).toHaveBeenLastCalledWith("/app/tools?category=hardware&keep=value", { scroll: false });
  fireEvent.click(screen.getByRole("button", { name: /^全部$/ }));
  expect(state.replace).toHaveBeenLastCalledWith("/app/tools?keep=value", { scroll: false });
});

// Execute the actual shipped bridge in an isolated DOM, never patch the vendor chunks.
function bridge(basePath: string) {
  const script = document.createElement("script");
  script.src = `http://localhost${basePath}/zutils/platform-navigation.js?v=nav-v1`;
  const descriptor = Object.getOwnPropertyDescriptor(document, "currentScript");
  Object.defineProperty(document, "currentScript", { configurable: true, value: script });
  const registration = vi.spyOn(document, "addEventListener");
  try { window.eval(readFileSync("public/zutils/platform-navigation.js", "utf8")); }

  finally {
    for (const [type, listener, options] of registration.mock.calls) {
      if (options === true) bridgeListeners.push([type, listener]);
    }
    registration.mockRestore();
    if (descriptor) Object.defineProperty(document, "currentScript", descriptor);
    else delete (document as unknown as Record<string, unknown>).currentScript;
  }
}

it.each(["", "/vibehard"])("routes all sidebar links out of the iframe with prefix %s", (prefix) => {
  const categories = ["all", "hardware", "instrument", "network", "code", "ai", "crc", "radix", "time", "design"];
  document.body.innerHTML = `<aside>${categories.map((id) => `<a href="#${id}">${id}</a>`).join("")}</aside><a href="#hardware" id="outside">outside</a>`;
  bridge(prefix);
  for (const link of document.querySelectorAll<HTMLAnchorElement>("aside a")) {
    const id = link.textContent!;
    const expected = prefix + (id === "ai" ? "/app/agent" : "/app/tools" + (id === "all" ? "" : `?category=${id}`));
    expect(link.getAttribute("href")).toBe(expected);
    expect(link.target).toBe("_top");
  }
  expect(document.getElementById("outside")!.getAttribute("href")).toBe("#hardware");
});

it("repairs a recreated React sidebar before keyboard or alternate native activation", () => {
  document.body.innerHTML = "<aside></aside>";
  bridge("/vibehard");
  for (const type of ["click", "pointerdown", "auxclick", "contextmenu"]) {
    const aside = document.querySelector("aside")!;
    aside.innerHTML = '<a href="/#network"><span>网络/串口调试</span></a><a href="#untrusted">unknown</a>';
    const link = aside.querySelector("a")!;
    link.addEventListener(type, (event) => event.preventDefault());
    link.querySelector("span")!.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    expect(link.getAttribute("href")).toBe("/vibehard/app/tools?category=network");
    expect(link.target).toBe("_top");
    expect(aside.lastElementChild!.getAttribute("href")).toBe("#untrusted");
  }
});
