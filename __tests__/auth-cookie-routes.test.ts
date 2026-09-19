// @vitest-environment node
import { createRequire } from "node:module";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as overview } from "@/app/api/admin/overview/route";
import { AUTH_COOKIE, createSessionToken, hashPassword } from "@/lib/server/security";
import { createUser, findUserByEmail, findUserById, getAdminOverview } from "@/lib/server/store";

// Use the same RFC-aware cookie jar as the browser test environment.
const { CookieJar } = createRequire(import.meta.url)("jsdom");
vi.mock("@/lib/server/store", () => ({
  createUser: vi.fn(), findUserByEmail: vi.fn(), findUserById: vi.fn(),
  getAdminOverview: vi.fn(), writeAuditLog: vi.fn(),
}));
const member = { id: "member-id", email: "member@example.test", name: "Member", role: "member" };
const admin = { id: "admin-id", email: "admin@example.test", name: "Admin", role: "admin" };
let passwordHash: string;

describe("authentication cookie migration through actual routes", () => {
  beforeAll(async () => { passwordHash = await hashPassword("test-password"); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "cookie-regression-test-only");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/vibehard");
    vi.stubEnv("INVITE_CODES", "TEST-INVITE");
    vi.mocked(findUserByEmail).mockResolvedValue({ ...admin, passwordHash } as Awaited<ReturnType<typeof findUserByEmail>>);
    vi.mocked(findUserById).mockImplementation(async (id) => ({ ...(id === admin.id ? admin : member), passwordHash } as NonNullable<Awaited<ReturnType<typeof findUserById>>>));
    vi.mocked(getAdminOverview).mockResolvedValue({ users: [admin, member] } as Awaited<ReturnType<typeof getAdminOverview>>);
  });
  afterEach(() => vi.unstubAllEnvs());

  for (const basePath of ["/vibehard", ""]) {
    it(`switches from a legacy member cookie to admin at ${basePath || "/"}`, async () => {
      vi.stubEnv("NEXT_PUBLIC_BASE_PATH", basePath);
      const base = `https://example.test${basePath}`;
      const jar = new CookieJar();
      jar.setCookieSync(`${AUTH_COOKIE}=${createSessionToken(member)}; Path=/; Secure; HttpOnly`, base);
      const result = await login(new NextRequest(`${base}/api/auth/login`, { method: "POST", body: JSON.stringify({ email: admin.email, password: "test-password" }) }));
      expect(result.status).toBe(200);
      const headers = result.headers.getSetCookie();
      expect(headers).toHaveLength(basePath ? 2 : 1);
      for (const header of headers) jar.setCookieSync(header, base);
      const cookie = jar.getCookieStringSync(`${base}/api/admin/overview`);
      expect(cookie.split("; ")).toHaveLength(1);
      expect((await overview(new NextRequest(`${base}/api/admin/overview`, { headers: { cookie } }))).status).toBe(200);
      const saved = headers.find((header) => !header.includes("Max-Age=0"))!;
      expect(saved).toContain("HttpOnly");
      expect(saved).toContain("Secure");
      expect(saved).toContain("SameSite=lax");
    });

    it(`logout removes all applicable session paths at ${basePath || "/"}`, async () => {
      vi.stubEnv("NEXT_PUBLIC_BASE_PATH", basePath);
      const base = `https://example.test${basePath}`;
      const jar = new CookieJar();
      jar.setCookieSync(`${AUTH_COOKIE}=${createSessionToken(member)}; Path=/; Secure; HttpOnly`, base);
      if (basePath) jar.setCookieSync(`${AUTH_COOKIE}=${createSessionToken(admin)}; Path=${basePath}; Secure; HttpOnly`, base);
      const result = await logout(new NextRequest(`${base}/api/auth/logout`, { method: "POST", headers: { cookie: jar.getCookieStringSync(base) } }));
      for (const header of result.headers.getSetCookie()) jar.setCookieSync(header, base);
      expect(jar.getCookieStringSync(`${base}/api/auth/session`)).toBe("");
      expect((await overview(new NextRequest(`${base}/api/admin/overview`))).status).toBe(401);
    });
  }

  it("registration replaces a legacy administrator cookie with the new member", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue({ ...member, passwordHash } as Awaited<ReturnType<typeof createUser>>);
    const base = "https://example.test/vibehard";
    const jar = new CookieJar();
    jar.setCookieSync(`${AUTH_COOKIE}=${createSessionToken(admin)}; Path=/; Secure; HttpOnly`, base);
    const result = await register(new NextRequest(`${base}/api/auth/register`, { method: "POST", body: JSON.stringify({ email: member.email, password: "test-password", inviteCode: "TEST-INVITE" }) }));
    expect(result.status).toBe(201);
    for (const header of result.headers.getSetCookie()) jar.setCookieSync(header, base);
    expect((await overview(new NextRequest(`${base}/api/admin/overview`, { headers: { cookie: jar.getCookieStringSync(base) } }))).status).toBe(403);
  });

  it("failed login does not change any session cookies", async () => {
    const result = await login(new NextRequest("https://example.test/vibehard/api/auth/login", { method: "POST", body: JSON.stringify({ email: admin.email, password: "wrong-password" }) }));
    expect(result.status).toBe(401);
    expect(result.headers.getSetCookie()).toEqual([]);
  });
});
