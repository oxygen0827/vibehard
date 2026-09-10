import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BomPage from "@/app/app/bom/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("BomPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("没有工程时不显示 BOM 表格", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ projects: [] }), { status: 200 }),
    ));

    render(<BomPage />);

    expect(await screen.findByText("暂无工程，暂时没有 BOM")).toBeInTheDocument();
    expect(screen.queryByText("位号")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /去创建工程/ })).toHaveAttribute("href", "/app/agent");
  });

  it("有工程时保留工程 BOM 表格", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ projects: [{ id: "p1", name: "测试工程", workspaceKey: "test", defaultModel: "gpt-5.6-terra" }] }), { status: 200 }),
    ));

    render(<BomPage />);

    expect(await screen.findByText("当前工程 BOM")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "选择工程" })).toHaveValue("p1");
    expect(screen.getByText("位号")).toBeInTheDocument();
  });
});
