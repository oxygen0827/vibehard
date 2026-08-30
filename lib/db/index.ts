import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
const client = connectionString ? postgres(connectionString, { max: 5 }) : null;
export const db = client ? drizzle(client, { schema }) : null;

export function assertProductionDatabaseConfigured() {
  if (process.env.NODE_ENV === "production" && !connectionString) {
    throw new Error("DATABASE_URL must be configured in production; refusing to use volatile memory storage");
  }
}

export function requireDb() {
  if (!db) throw new Error("DATABASE_URL 未配置。开发环境可使用内存适配器，生产环境必须配置 PostgreSQL。");
  return db;
}

export async function closeDb() {
  await client?.end();
}
