import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be configured in production");
  return "vibehard-development-session-secret";
}
export const AUTH_COOKIE = "vibehard_session";
export interface SessionUser { id: string; email: string; name: string; role: string; }
export async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const derived = (await scrypt(password, salt, 64)) as Buffer; return `scrypt:${salt}:${derived.toString("hex")}`; }
export async function verifyPassword(password: string, encoded: string) { const [algorithm, salt, digest] = encoded.split(":"); if (algorithm !== "scrypt" || !salt || !digest) return false; const expected = Buffer.from(digest, "hex"); const actual = (await scrypt(password, salt, expected.length)) as Buffer; return expected.length === actual.length && timingSafeEqual(expected, actual); }
function signature(payload: string) { return createHmac("sha256", sessionSecret()).update(payload).digest("base64url"); }
export function createSessionToken(user: SessionUser, days = 7) { const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + days * 86_400_000 })).toString("base64url"); return `${payload}.${signature(payload)}`; }
export function readSessionToken(token?: string): SessionUser | null { if (!token) return null; const [payload, suppliedSignature] = token.split("."); if (!payload || !suppliedSignature) return null; const expected = Buffer.from(signature(payload)); const supplied = Buffer.from(suppliedSignature); if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null; try { const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number }; if (!parsed.id || !parsed.email || parsed.exp <= Date.now()) return null; return { id: parsed.id, email: parsed.email, name: parsed.name, role: parsed.role }; } catch { return null; } }
export function hashRunnerSecret(secret: string) { return createHmac("sha256", sessionSecret()).update(`runner:${secret}`).digest("hex"); }
