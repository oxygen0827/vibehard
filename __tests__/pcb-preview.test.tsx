import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PcbPage from "@/app/app/pcb/page";
import { renderExampleBoard } from "@/components/pcb/example-board";

vi.mock("@/components/pcb/example-board", () => ({ renderExampleBoard: vi.fn() }));

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("PCB example preview", () => {
  it("generates the detailed preview, switches layers, and can generate again", () => {
    render(<PcbPage />);
    expect(screen.queryByRole("img", { name: /PCB/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始生成 PCB" }));
    expect(screen.getByRole("button", { name: "生成中..." })).toBeDisabled();
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.getByRole("img", { name: /PCB 装配预览/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出 Gerber" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "布线视图" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "底层铜" }));
    expect(renderExampleBoard).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), expect.objectContaining({ view: "routing", bottom: false }));
    fireEvent.click(screen.getByRole("button", { name: "装配视图" }));
    expect(renderExampleBoard).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), expect.objectContaining({ view: "assembly", top: true, bottom: true }));
    fireEvent.click(screen.getByRole("button", { name: "放大 PCB" }));
    expect(screen.getByText("125%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "适应画布" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    const data = "data:image/png;base64,test";
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(data);
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("VibeHard-TH-Node-assembly.png");
      expect(this.href).toBe(data);
    });
    fireEvent.click(screen.getByRole("button", { name: "下载 PCB 预览 PNG" }));
    expect(download).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(screen.queryByRole("img", { name: /PCB/ })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.getByRole("img", { name: /PCB 装配预览/ })).toBeInTheDocument();
  });

  it("clears pending generation when leaving the page", () => {
    const { unmount } = render(<PcbPage />);
    fireEvent.click(screen.getByRole("button", { name: "开始生成 PCB" }));
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(5);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
