import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RunnerEvent, TaskStart } from "@/lib/agent/protocol";

interface RunnerState {
  seenCommandIds: string[];
  outboundEvents: RunnerEvent[];
  activeTasks: TaskStart[];
}

const EMPTY_STATE: RunnerState = { seenCommandIds: [], outboundEvents: [], activeTasks: [] };

export class RunnerJournal {
  private state: RunnerState;

  constructor(private readonly filePath: string) {
    mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<RunnerState>;
      this.state = {
        seenCommandIds: Array.isArray(parsed.seenCommandIds) ? parsed.seenCommandIds.filter((item): item is string => typeof item === "string").slice(-10_000) : [],
        outboundEvents: Array.isArray(parsed.outboundEvents) ? parsed.outboundEvents : [],
        activeTasks: Array.isArray(parsed.activeTasks) ? parsed.activeTasks : [],
      };
    } catch {
      this.state = structuredClone(EMPTY_STATE);
    }
  }

  private persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(this.state)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }

  hasSeen(commandId: string) {
    return this.state.seenCommandIds.includes(commandId);
  }

  markSeen(commandId: string) {
    if (this.hasSeen(commandId)) return;
    this.state.seenCommandIds.push(commandId);
    if (this.state.seenCommandIds.length > 10_000) this.state.seenCommandIds.splice(0, this.state.seenCommandIds.length - 10_000);
    this.persist();
  }

  enqueueEvent(event: RunnerEvent) {
    if (this.state.outboundEvents.some((item) => item.event.eventId === event.event.eventId)) return;
    this.state.outboundEvents.push(event);
    this.persist();
  }

  acknowledgeEvent(eventId: string) {
    const next = this.state.outboundEvents.filter((item) => item.event.eventId !== eventId);
    if (next.length === this.state.outboundEvents.length) return;
    this.state.outboundEvents = next;
    this.persist();
  }

  outboundEvents() {
    return [...this.state.outboundEvents];
  }

  setActiveTask(task: TaskStart) {
    this.state.activeTasks = [...this.state.activeTasks.filter((item) => item.taskId !== task.taskId), task];
    this.persist();
  }

  removeActiveTask(taskId: string) {
    const next = this.state.activeTasks.filter((item) => item.taskId !== taskId);
    if (next.length === this.state.activeTasks.length) return;
    this.state.activeTasks = next;
    this.persist();
  }

  activeTasks() {
    return [...this.state.activeTasks];
  }
}
