import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, logout, register } from "@/lib/auth";

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("auth client", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  it("将登录凭据提交给服务端认证接口", async () => { vi.mocked(fetch).mockReturnValue(response({ user: { id: "u1", email: "demo@vibehard.ai", name: "Demo", role: "member" } })); const result = await login({ email: "demo@vibehard.ai", password: "demo1234" }); expect(result.ok).toBe(true); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/auth/login"), expect.objectContaining({ method: "POST" })); });
  it("透传服务端登录错误", async () => { vi.mocked(fetch).mockReturnValue(response({ error: "邮箱或密码错误" }, 401)); expect(await login({ email: "demo@vibehard.ai", password: "wrong-pass" })).toEqual({ ok: false, error: "邮箱或密码错误" }); });
  it("提交邀请码注册", async () => { vi.mocked(fetch).mockReturnValue(response({ user: { id: "u2" } }, 201)); expect((await register({ email: "new@example.com", password: "password123", inviteCode: "VIBE2026" })).ok).toBe(true); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/auth/register"), expect.objectContaining({ method: "POST" })); });
  it("调用服务端退出接口", async () => { vi.mocked(fetch).mockReturnValue(response({ ok: true })); await logout(); expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/auth/logout"), expect.objectContaining({ method: "POST" })); });
});
