export const RUNNER_PROTOCOL_VERSION = 1 as const;

export type ApprovalDecision = "approve" | "reject";
export type AgentEventType =
  | "task.started"
  | "agent.message.delta"
  | "agent.message"
  | "reasoning"
  | "tool.started"
  | "tool.completed"
  | "command.output"
  | "file.changed"
  | "approval.requested"
  | "artifact.created"
  | "task.completed"
  | "task.failed"
  | "task.interrupted";

export interface AgentEvent {
  eventId: string;
  sequence: number;
  timestamp: string;
  type: AgentEventType;
  data: Record<string, unknown>;
}

export interface Envelope {
  protocolVersion: typeof RUNNER_PROTOCOL_VERSION;
  messageId: string;
  timestamp: string;
}

export interface RunnerHello extends Envelope {
  type: "runner.hello";
  runnerKey: string;
  secret: string;
  capabilities: string[];
  codexVersion?: string;
}

export interface RunnerAccepted extends Envelope {
  type: "runner.accepted";
  runnerKey: string;
}

export interface TaskStart extends Envelope {
  type: "task.start";
  taskId: string;
  projectId: string;
  threadId: string;
  codexThreadId?: string;
  workspaceKey: string;
  input: string;
  model: string;
  modelProvider?: string;
}

export interface TaskInterrupt extends Envelope {
  type: "task.interrupt";
  taskId: string;
  threadId: string;
}

export interface ApprovalResolve extends Envelope {
  type: "approval.resolve";
  taskId: string;
  approvalId: string;
  decision: ApprovalDecision;
}

export interface RunnerEvent extends Envelope {
  type: "event";
  runnerKey: string;
  taskId: string;
  threadId?: string;
  codexThreadId?: string;
  event: AgentEvent;
}

export interface Heartbeat extends Envelope {
  type: "heartbeat";
  runnerKey: string;
}

export interface CommandAck extends Envelope {
  type: "command.ack";
  runnerKey: string;
  commandId: string;
}

export type PlatformToRunnerMessage = TaskStart | TaskInterrupt | ApprovalResolve;
export type GatewayToRunnerMessage = RunnerAccepted | PlatformToRunnerMessage;
export type RunnerToPlatformMessage = RunnerHello | RunnerEvent | Heartbeat | CommandAck;

export function assertProtocolVersion(version: unknown): asserts version is typeof RUNNER_PROTOCOL_VERSION {
  if (version !== RUNNER_PROTOCOL_VERSION) throw new Error(`Unsupported runner protocol version: ${String(version)}`);
}

export function envelope() {
  return {
    protocolVersion: RUNNER_PROTOCOL_VERSION,
    messageId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}
