// One-time import of the already-authorized cloud provider; never prints secrets.
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { requireDb, closeDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { publicLlm, saveLlm } from "@/lib/server/llm-settings";

async function main() {
  const config = await readFile("/etc/vibehard/codex/config.toml", "utf8");
  const model = /^model\s*=\s*"([^"\n]+)"/m.exec(config)?.[1];
  const baseUrl = /^base_url\s*=\s*"([^"\n]+)"/m.exec(config)?.[1];
  const envKey = /^env_key\s*=\s*"([^"\n]+)"/m.exec(config)?.[1];
  if (!model || !baseUrl || !envKey || !process.env[envKey]) throw new Error("Existing cloud provider configuration is incomplete");
  const admin = (await requireDb().select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1))[0];
  for (const purpose of ["design", "agent"] as const) {
    const existing = await publicLlm(purpose);
    if (existing.hasApiKey) { console.log(`${purpose}: existing managed configuration preserved`); continue; }
    await saveLlm({ purpose, baseUrl, model, protocol: "responses", apiKey: process.env[envKey], revision: null }, admin?.id ?? null);
    console.log(`${purpose}: imported existing provider; live availability not yet verified`);
  }
}
void main().catch((error) => {
  const known = ["Existing cloud provider configuration is incomplete", "No administrator account exists"];
  console.error(known.includes(error?.message) ? error.message : "LLM configuration import failed; check database migration and encryption secret (credentials suppressed)");
  process.exitCode = 1;
}).finally(closeDb);
