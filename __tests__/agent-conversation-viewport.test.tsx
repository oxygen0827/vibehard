import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentConversationViewport } from "@/components/app/agent-conversation-viewport";

let height: number;
let resize: () => void;
const disconnect = vi.fn();
beforeEach(() => {
  height = 1200;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(() => height);
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); disconnect.mockClear(); });

it("opens at the latest output and follows streaming replies inside the message region", () => {
  const { rerender } = render(<AgentConversationViewport revision="1">第一条回复</AgentConversationViewport>);
  const messages = screen.getByRole("region", { name: "会话消息" });
  expect(messages.scrollTop).toBe(1200);
  height = 1600;
  rerender(<AgentConversationViewport revision="2">第一条回复；新的流式回复</AgentConversationViewport>);
  expect(messages.scrollTop).toBe(1600);
  expect(screen.queryByRole("button", { name: "回到最新" })).not.toBeInTheDocument();
});

it("leaves history in place on new output until the reader chooses to return to latest", () => {
  const { rerender } = render(<AgentConversationViewport revision="1">之前的记录</AgentConversationViewport>);
  const messages = screen.getByRole("region", { name: "会话消息" });
  messages.scrollTop = 120;
  fireEvent.scroll(messages);
  height = 1600;
  rerender(<AgentConversationViewport revision="2">之前的记录；新回复</AgentConversationViewport>);
  act(() => resize());
  expect(messages.scrollTop).toBe(120);
  expect(screen.getByText("之前的记录；新回复")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "回到最新" }));
  expect(messages.scrollTop).toBe(1600);
  expect(screen.queryByRole("button", { name: "回到最新" })).not.toBeInTheDocument();
  height = 2000;
  rerender(<AgentConversationViewport revision="3">后续回复</AgentConversationViewport>);
  expect(messages.scrollTop).toBe(2000);
});

it("resumes following when the reader manually scrolls back to the bottom", () => {
  const { rerender } = render(<AgentConversationViewport revision="1">记录</AgentConversationViewport>);
  const messages = screen.getByRole("region", { name: "会话消息" });
  messages.scrollTop = 100; fireEvent.scroll(messages);
  expect(screen.getByRole("button", { name: "回到最新" })).toBeInTheDocument();
  messages.scrollTop = 800; fireEvent.scroll(messages);
  height = 1800;
  rerender(<AgentConversationViewport revision="2">记录和新消息</AgentConversationViewport>);
  expect(messages.scrollTop).toBe(1800);
});

it("follows layout resizing while at the bottom and disconnects the observer on exit", () => {
  const { unmount } = render(<AgentConversationViewport revision="1">回复</AgentConversationViewport>);
  height = 1800;
  act(() => resize());
  expect(screen.getByRole("region", { name: "会话消息" }).scrollTop).toBe(1800);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("starts at the latest record when switching to another conversation", () => {
  const { rerender } = render(<AgentConversationViewport key="first" revision="1">旧会话</AgentConversationViewport>);
  const old = screen.getByRole("region", { name: "会话消息" });
  old.scrollTop = 100; fireEvent.scroll(old);
  rerender(<AgentConversationViewport key="second" revision="1">另一个会话</AgentConversationViewport>);
  expect(screen.getByRole("region", { name: "会话消息" }).scrollTop).toBe(1200);
  expect(screen.queryByRole("button", { name: "回到最新" })).not.toBeInTheDocument();
});

it("does not jump to the bottom when the reader expands reasoning or evidence", () => {
  const { container } = render(<AgentConversationViewport revision="1"><details><summary>推理过程</summary>更多记录</details></AgentConversationViewport>);
  const details = container.querySelector("details")!;
  fireEvent.click(screen.getByText("推理过程"));
  // ResizeObserver can run before the asynchronous native toggle event.
  height = 2200; act(() => resize());
  expect(screen.getByRole("region", { name: "会话消息" }).scrollTop).toBe(1200);
  details.open = true; fireEvent(details, new Event("toggle"));
  height = 2400; act(() => resize());
  expect(screen.getByRole("region", { name: "会话消息" }).scrollTop).toBe(1200);
  expect(screen.getByRole("button", { name: "回到最新" })).toBeInTheDocument();
});
