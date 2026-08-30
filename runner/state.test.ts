import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { envelope, type RunnerEvent, type TaskStart } from "@/lib/agent/protocol";
import { RunnerJournal } from "./state";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("RunnerJournal", () => {
  it("restores command ids, unacknowledged events and active tasks after restart", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "vibehard-runner-state-"));
    temporaryDirectories.push(directory);
    const stateFile = path.join(directory, "state.json");
    const commandId = crypto.randomUUID();
    const task: TaskStart = { ...envelope(), type: "task.start", taskId: crypto.randomUUID(), projectId: crypto.randomUUID(), threadId: crypto.randomUUID(), workspaceKey: "owner/project", input: "test", model: "fake-model" };
    const outgoing: RunnerEvent = { ...envelope(), type: "event", runnerKey: "runner-1", taskId: task.taskId, threadId: task.threadId, event: { eventId: crypto.randomUUID(), sequence: 0, timestamp: new Date().toISOString(), type: "task.started", data: {} } };

    const initial = new RunnerJournal(stateFile);
    initial.markSeen(commandId);
    initial.enqueueEvent(outgoing);
    initial.setActiveTask(task);

    const restored = new RunnerJournal(stateFile);
    expect(restored.hasSeen(commandId)).toBe(true);
    expect(restored.outboundEvents()).toEqual([outgoing]);
    expect(restored.activeTasks()).toEqual([task]);

    restored.acknowledgeEvent(outgoing.event.eventId);
    restored.removeActiveTask(task.taskId);
    const acknowledged = new RunnerJournal(stateFile);
    expect(acknowledged.outboundEvents()).toEqual([]);
    expect(acknowledged.activeTasks()).toEqual([]);
  });
});
