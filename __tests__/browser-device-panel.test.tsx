import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrowserDevicePanel } from "@/components/app/browser-device-panel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("archives a real adapter result only to the selected project and offers explicit Agent analysis, not automatic model execution", async () => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "usb", { configurable: true, value: {} });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => { void url; void init; return Response.json({ document: { id: "saved", path: "documents/device-report-saved.md" } }); });
  vi.stubGlobal("fetch", fetcher);
  const close = vi.fn(); const analyze = vi.fn();
  const probe = { model: "Luckfox Aura", compatible: ["rockchip,rv1126b"], kernel: "Linux 6.1.141 aarch64", os: "Debian 13",
    memoryTotalKiB: 1010588, memoryAvailableKiB: 756816, uptimeSeconds: 42,
    storage: [{ mount: "/", availableKiB: 458360, usedPercent: 89 }, { mount: "/userdata", availableKiB: 952400, usedPercent: 5 }],
    services: { api: "active", kiosk: "active" } };
  const connect = vi.fn(async () => ({ serial: "test-rv1126b", usbName: "rk3xxx", read: async () => probe, close, disconnected: new Promise<void>(() => {}) }));
  render(<BrowserDevicePanel projectId="project-a" connect={connect} onArchived={analyze} />);
  fireEvent.click(screen.getByRole("button", { name: "USB 连接并归档只读报告" }));
  await screen.findByText(/报告已归档/);
  expect(fetcher.mock.calls[0][0]).toBe("/api/projects/project-a/device-reports");
  const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
  expect(body).toMatchObject({ transport: "browser-webusb-direct", serial: "test-rv1126b", probe });
  expect(analyze).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "让 Agent 分析这份设备报告" }));
  expect(analyze).toHaveBeenCalledWith("documents/device-report-saved.md");
  cleanup(); await waitFor(() => expect(close).toHaveBeenCalled());
});
it("shows archive failure honestly and retries the same snapshot without reading the board again", async () => {
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "usb", { configurable: true, value: {} });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => { void url; void init; return Response.json({ error: "项目资料暂不可用" }, { status: 503 }); });
  vi.stubGlobal("fetch", fetcher);
  const read = vi.fn(async () => ({ model: "Luckfox Aura", compatible: ["rockchip,rv1126b"], kernel: "Linux 6.1.141 aarch64", os: "Debian 13",
    memoryTotalKiB: 1000, memoryAvailableKiB: 900, uptimeSeconds: 42,
    storage: [{ mount: "/", availableKiB: 458360, usedPercent: 89 }, { mount: "/userdata", availableKiB: 952400, usedPercent: 5 }], services: { api: "active", kiosk: "active" } }));
  render(<BrowserDevicePanel projectId="project-a" onArchived={vi.fn()} connect={async () => ({ serial: "test-rv1126b", usbName: "rk3xxx", close: vi.fn(), read, disconnected: new Promise<void>(() => {}) })} />);
  fireEvent.click(screen.getByRole("button", { name: "USB 连接并归档只读报告" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("status")).toHaveTextContent("归档失败");
  expect(screen.queryByRole("button", { name: "让 Agent 分析这份设备报告" })).not.toBeInTheDocument();
  fetcher.mockImplementation(async () => Response.json({ document: { path: "documents/device-report-saved.md" } }));
  fireEvent.click(screen.getByRole("button", { name: "重试归档" }));
  await screen.findByText(/报告已归档/);
  expect(read).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[1][1]!.body).toBe(fetcher.mock.calls[0][1]!.body);
});
