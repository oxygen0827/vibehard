import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const turnStatus = pgEnum("turn_status", ["queued", "running", "waiting_approval", "completed", "failed", "interrupted"]);
export const runnerStatus = pgEnum("runner_status", ["offline", "online", "busy", "revoked"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected", "expired"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default("VibeHard 用户"),
  role: text("role").notNull().default("member"),
  inviteCode: text("invite_code"),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  workspaceKey: text("workspace_key").notNull(),
  runnerKey: text("runner_key"),
  defaultModel: text("default_model").notNull().default("gpt-5.6-terra"),
  ...timestamps,
}, (table) => [index("projects_user_updated_idx").on(table.userId, table.updatedAt)]);

export const runnerNodes = pgTable("runner_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  runnerKey: text("runner_key").notNull().unique(),
  name: text("name").notNull(),
  status: runnerStatus("status").notNull().default("offline"),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  instanceId: uuid("instance_id"),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  secretHash: text("secret_hash"),
  ...timestamps,
});

export const agentThreads = pgTable("agent_threads", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runnerId: uuid("runner_id").references(() => runnerNodes.id),
  codexThreadId: text("codex_thread_id"),
  title: text("title").notNull().default("新建 Agent 会话"),
  ...timestamps,
}, (table) => [index("agent_threads_project_updated_idx").on(table.projectId, table.updatedAt)]);

export const agentTurns = pgTable("agent_turns", {
  id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id").notNull().references(() => agentThreads.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  model: text("model").notNull(),
  status: turnStatus("status").notNull().default("queued"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("agent_turns_thread_status_idx").on(table.threadId, table.status)]);

export const agentEvents = pgTable("agent_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  turnId: uuid("turn_id").notNull().references(() => agentTurns.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  sequence: integer("sequence").notNull(),
  ...timestamps,
}, (table) => [index("agent_events_turn_sequence_idx").on(table.turnId, table.sequence)]);

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  turnId: uuid("turn_id").notNull().references(() => agentTurns.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  risk: text("risk").notNull(),
  description: text("description").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  status: approvalStatus("status").notNull().default("pending"),
  decisionBy: uuid("decision_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("approvals_turn_status_idx").on(table.turnId, table.status)]);

export const artifacts = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  turnId: uuid("turn_id").references(() => agentTurns.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  path: text("path").notNull(),
  ...timestamps,
});

export const modelProfiles = pgTable("model_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: text("provider_id").notNull(),
  model: text("model").notNull(),
  displayName: text("display_name").notNull(),
  baseUrl: text("base_url"),
  envKey: text("env_key"),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
}, (table) => [uniqueIndex("model_profiles_provider_model_uidx").on(table.providerId, table.model)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps,
});

export const runnerCommands = pgTable("runner_commands", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => agentTurns.id, { onDelete: "cascade" }),
  runnerKey: text("runner_key").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  ...timestamps,
}, (table) => [index("runner_commands_queue_idx").on(table.runnerKey, table.status, table.createdAt)]);

export const userRelations = relations(users, ({ many }) => ({ projects: many(projects), turns: many(agentTurns) }));
export const projectRelations = relations(projects, ({ one, many }) => ({ user: one(users, { fields: [projects.userId], references: [users.id] }), threads: many(agentThreads), artifacts: many(artifacts) }));
