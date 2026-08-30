import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const mode = process.env.FAKE_CODEX_MODE ?? "complete";
lines.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === "initialize") send({ id: message.id, result: { userAgent: "fake" } });
  if (message.method === "thread/start") send({ id: message.id, result: { thread: { id: "thread_fake" } } });
  if (message.method === "thread/resume") send({ id: message.id, result: { thread: { id: message.params.threadId } } });
  if (message.method === "turn/start") {
    send({ id: message.id, result: { turn: { id: "turn_fake" } } });
    if (mode === "approval") send({ id: "approval_fake", method: "item/commandExecution/requestApproval", params: { command: "git status", reason: "Inspect repository" } });
    else if (mode !== "interrupt") { send({ method: "item/agentMessage/delta", params: { delta: "fake response" } }); send({ method: "turn/completed", params: { turn: { id: "turn_fake", status: "completed" } } }); }
  }
  if (message.id === "approval_fake" && message.result?.decision) send({ method: "turn/completed", params: { turn: { id: "turn_fake", status: message.result.decision === "accept" ? "completed" : "failed" } } });
  if (message.method === "turn/interrupt") { send({ id: message.id, result: {} }); send({ method: "turn/completed", params: { turn: { id: "turn_fake", status: "interrupted" } } }); }
});
