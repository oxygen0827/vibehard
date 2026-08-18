import { describe, it, expect, beforeEach } from "vitest";
import { login, register, logout, AUTH_COOKIE } from "@/lib/auth";

function getSessionCookie() {
  return document.cookie.includes(`${AUTH_COOKIE}=`);
}

describe("auth", () => {
  beforeEach(async () => {
    await logout();
  });

  it("拒绝格式错误的邮箱", async () => {
    const result = await login({ email: "not-an-email", password: "demo1234" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("邮箱");
    expect(getSessionCookie()).toBe(false);
  });

  it("拒绝少于 8 位的密码", async () => {
    const result = await login({ email: "demo@vibehard.ai", password: "short" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("8 位");
    expect(getSessionCookie()).toBe(false);
  });

  it("拒绝错误的凭据", async () => {
    const result = await login({ email: "demo@vibehard.ai", password: "wrong-password" });
    expect(result.ok).toBe(false);
    expect(getSessionCookie()).toBe(false);
  });

  it("演示账号登录成功并写入会话 Cookie", async () => {
    const result = await login({ email: "demo@vibehard.ai", password: "demo1234" });
    expect(result.ok).toBe(true);
    expect(getSessionCookie()).toBe(true);
  });

  it("拒绝无效邀请码注册", async () => {
    const result = await register({
      email: "new@example.com",
      password: "password123",
      inviteCode: "INVALID",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("邀请码");
    expect(getSessionCookie()).toBe(false);
  });

  it("有效邀请码注册成功并写入会话 Cookie", async () => {
    const result = await register({
      email: "new@example.com",
      password: "password123",
      inviteCode: "vibe2026",
    });
    expect(result.ok).toBe(true);
    expect(getSessionCookie()).toBe(true);
  });

  it("登出后清除会话 Cookie", async () => {
    await login({ email: "demo@vibehard.ai", password: "demo1234" });
    expect(getSessionCookie()).toBe(true);
    await logout();
    expect(getSessionCookie()).toBe(false);
  });
});
