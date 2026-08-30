import { authenticateRunner, getQueuedRunnerCommands, heartbeatRunner, ingestRunnerEvent, markRunnerCommand, markRunnerOffline, markStaleRunnersOffline } from "@/lib/server/store";
import { assertProductionDatabaseConfigured } from "@/lib/db";
import { createRunnerGateway } from "./server";

assertProductionDatabaseConfigured();

const port = Number(process.env.GATEWAY_PORT ?? 8787);
const host = process.env.GATEWAY_HOST ?? "127.0.0.1";
const gateway = createRunnerGateway({ authenticateRunner, getQueuedRunnerCommands, heartbeatRunner, ingestRunnerEvent, markRunnerCommand, markRunnerOffline, markStaleRunnersOffline });

gateway.server.listen(port, host, () => console.log(`VibeHard runner gateway listening on ${host}:${port}`));
