import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, requireDb } from "@/lib/db";

async function main() {
  const database = requireDb();
  try {
    await migrate(database, { migrationsFolder: "./drizzle" });
    console.log("Database migrations applied");
  } finally {
    await closeDb();
  }
}

void main().catch((error) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
