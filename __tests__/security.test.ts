import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, readSessionToken, verifyPassword } from "@/lib/server/security";

describe("security", () => {
  it("使用 scrypt 哈希并验证密码", async () => { const hash = await hashPassword("strong-password"); expect(hash).not.toContain("strong-password"); expect(await verifyPassword("strong-password", hash)).toBe(true); expect(await verifyPassword("wrong-password", hash)).toBe(false); });
  it("签名并校验服务端会话", () => { const token = createSessionToken({ id: "u1", email: "user@example.com", name: "User", role: "member" }); expect(readSessionToken(token)?.id).toBe("u1"); expect(readSessionToken(`${token}tampered`)).toBeNull(); });
});
