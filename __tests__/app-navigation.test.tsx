import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppNav } from "@/components/app/app-nav";
import { DashboardGrid } from "@/components/app/dashboard-grid";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <button>切换主题</button> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("platform navigation", () => {
  it("opens the full mobile menu and closes it after navigation or Escape", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ authenticated: false }) }));
    const { container } = render(<AppNav />);
    const menu = container.querySelector<HTMLElement>("#mobile-app-navigation")!;
    expect(menu).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "打开功能菜单" }));
    menu.addEventListener("click", event => event.preventDefault());
    expect(menu).toBeVisible();
    expect(within(menu).getByRole("link", { name: "电路工作台" })).toHaveAttribute("href", "/app/eda");
    expect(within(menu).getByRole("link", { name: "芯片资料" })).toHaveAttribute("href", "/app/datasheets");
    expect(within(menu).getByRole("link", { name: "设备开发" })).toHaveAttribute("href", "/app/taishan");
    await user.keyboard("{Escape}");
    expect(menu).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "打开功能菜单" }));
    await user.click(within(menu).getByRole("link", { name: "原理图识别" }));
    expect(menu).not.toBeVisible();
  });

  it("shows actual destinations without invented account activity", () => {
    const { container } = render(<DashboardGrid projects={[]} jobs={[]} />);
    expect(screen.getByRole("heading", { name: "常用路径" })).toBeVisible();
    expect(screen.getByRole("link", { name: /建立项目/ })).toHaveAttribute("href", "/app/agent");
    expect(screen.getByRole("heading", { name: "最近项目" })).toBeVisible();
    expect(screen.getByText("暂无记录")).toBeVisible();
    expect(container.textContent).not.toMatch(/本周使用|剩余配额|STM32 温湿度监测节点/);
  });
});
