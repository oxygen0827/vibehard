"use client";

export const AUTH_COOKIE = "vibehard_session";
export const AUTH_CHANGED_EVENT = "vibehard-auth-changed";
export interface LoginInput { email: string; password: string; }
export interface RegisterInput { email: string; password: string; inviteCode: string; }
export interface AuthResult { ok: boolean; error?: string; user?: { id: string; email: string; name: string; role: string }; }
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

async function post(path: string, body?: unknown): Promise<AuthResult> {
  try {
    const response = await fetch(`${basePath}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error ?? "请求失败，请稍后重试" };
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    return { ok: true, user: data.user };
  } catch { return { ok: false, error: "网络连接失败，请检查服务是否启动" }; }
}

export function setSessionCookie() { window.dispatchEvent(new Event(AUTH_CHANGED_EVENT)); }
export function clearSessionCookie() { window.dispatchEvent(new Event(AUTH_CHANGED_EVENT)); }
export async function login(input: LoginInput) { return post("/api/auth/login", input); }
export async function register(input: RegisterInput) { return post("/api/auth/register", input); }
export async function logout() { await post("/api/auth/logout"); }
