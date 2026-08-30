import { authenticateRunner, getQueuedRunnerCommands, heartbeatRunner, ingestRunnerEvent, markRunnerCommand } from "@/lib/server/store";
import { createRunnerGateway } from "./server";

const port = Number(process.env.GATEWAY_PORT ?? 8787);
const host = process.env.GATEWAY_HOST ?? "127.0.0.1";
const gateway = createRunnerGateway({ authenticateRunner, getQueuedRunnerCommands, heartbeatRunner, ingestRunnerEvent, markRunnerCommand });

gateway.server.listen(port, host, () => console.log(`VibeHard runner gateway listening on ${host}:${port}`));
