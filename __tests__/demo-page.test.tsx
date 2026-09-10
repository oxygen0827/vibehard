import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DemoPage from "@/app/demo/page";
import { DemoPlayer, ShareButton } from "@/app/demo/showcase-controls";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("DemoPage", () => {
  it("uses the five supplied animated GIFs in workflow order", () => {
    const { container } = render(<DemoPage />);
    expect(screen.getByRole("heading", { name: "VibeHard." })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll("section[id]")).map((section) => section.id)).toEqual([
      "requirement-to-design", "chip-resources", "schematic-to-pcb", "pcb-to-debug", "debug-to-firmware",
    ]);
    expect(Array.from(container.querySelectorAll("img[src$='.gif']")).map((image) => image.getAttribute("src"))).toEqual(
      ["design", "datasheets", "pcb", "debug", "embedded"].map((slug) => `/demo/recordings/${slug}.gif`),
    );
    expect(Array.from(container.querySelectorAll("img[src$='.gif']")).every((image) => image.getAttribute("loading") === "lazy")).toBe(true);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /播放|暂停|重新播放|放大观看/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入工作台/ })).toHaveAttribute("href", "/login");
    expect(screen.queryByText(/可烧录|真实构建|KiCad/)).not.toBeInTheDocument();
    expect(screen.getAllByText("模块简介")).toHaveLength(5);
    expect(screen.getByText(/输入一段产品需求/)).toBeInTheDocument();
    expect(screen.getByText(/原理图确认后/)).toBeInTheDocument();
    expect(screen.getByText(/硬件能力验证完成后/)).toBeInTheDocument();
  });

  it("uses the native animated GIF without relying on JS media playback", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    render(<DemoPlayer slug="pcb" label="PCB" index={3} />);
    const image = screen.getByRole("img", { name: "PCB操作实录" }) as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("/demo/recordings/pcb.gif");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("decoding")).toBe("async");
    expect(document.querySelector("video")).not.toBeInTheDocument();
  });

  it("provides the original recording when the GIF fails", () => {
    render(<DemoPlayer slug="pcb" label="PCB" index={3} />);
    fireEvent.error(screen.getByRole("img", { name: "PCB操作实录" }));
    expect(screen.getByRole("status")).toHaveTextContent("视频暂时无法播放");
    expect(screen.getByRole("link", { name: "查看原始 GIF" })).toHaveAttribute("href", "/demo/recordings/pcb.gif");
  });

  it("copies a clean showcase URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    window.history.replaceState(null, "", "/demo#schematic-to-pcb");
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: "复制分享链接" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/demo`));
    expect(screen.getByRole("button", { name: "链接已复制" })).toBeInTheDocument();
  });
});
