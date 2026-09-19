import { expect, it } from "vitest";
import { conversationMessages } from "@/lib/agent/messages";
it("combines streaming fragments, replaces final text, and preserves separate turns", () => {
  const event = (type: string, text: string, id: string) => ({ eventId: id, type, sequence: 0, timestamp: "now", data: { text, itemId: "same" } });
  const input = [event("task.started", "question", "1"), event("agent.message.delta", "hel", "2"), event("agent.message.delta", "lo", "3"), event("agent.message", "hello!", "4"), event("task.started", "next", "5"), event("agent.message.delta", "second", "6")];
  expect(conversationMessages(input).map((v) => v.data.text)).toEqual(["question", "hello!", "next", "second"]);
  expect(input[1].data.text).toBe("hel");
});
