import { expect, it } from "vitest";
import { conversationMessages } from "@/lib/agent/messages";
it("combines streaming fragments, replaces final text, and preserves separate turns", () => {
  const event = (type: string, text: string, id: string) => ({ eventId: id, type, sequence: 0, timestamp: "now", data: { text, itemId: "same" } });
  const input = [event("task.started", "question", "1"), event("agent.message.delta", "hel", "2"), event("agent.message.delta", "lo", "3"), event("agent.message", "hello!", "4"), event("task.started", "next", "5"), event("agent.message.delta", "second", "6")];
  expect(conversationMessages(input).map((v) => v.data.text)).toEqual(["question", "hello!", "next", "second"]);
  expect(input[1].data.text).toBe("hel");
});

it("combines reasoning fragments into one entry per item and turn", () => {
  const event = (type: string, text: string, id: string, itemId = "reasoning_1") => ({ eventId: id, type, sequence: Number(id), timestamp: "now", data: { text, itemId } });
  const input = [
    event("task.started", "first task", "1"),
    event("reasoning", "The ", "2"),
    event("reasoning", "user ", "3"),
    event("reasoning", "wants", "4"),
    event("agent.message", "answer", "5", "answer_1"),
    event("task.started", "second task", "6"),
    event("reasoning", "Next task", "7"),
  ];
  const output = conversationMessages(input);
  expect(output.filter((item) => item.type === "reasoning").map((item) => item.data.text)).toEqual(["The user wants", "Next task"]);
  expect(output.find((item) => item.type === "agent.message")?.data.text).toBe("answer");
  expect(input[1].data.text).toBe("The ");
});
