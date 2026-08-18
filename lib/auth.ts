// Mock 认证模块：基于 Cookie 的会话管理
// 后续接入真实后端时，只需替换 login/register/logout 的实现

export const AUTH_COOKIE = "vibehard_session";
export const AUTH_CHANGED_EVENT = "vibehard-auth-changed";

// 演示账号（真实后端就绪后删除）
const DEMO_USERS = [
  { email: "demo@vibehard.ai", password: "demo1234", name: "Demo 用户" },
];

const VALID_INVITE_CODES = ["VIBE2026", "DEVHARD", "HARDWARE"];

export function setSessionCookie(days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${AUTH_COOKIE}=1; path=/; expires=${expires}; SameSite=Lax`;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearSessionCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  inviteCode: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "请输入邮箱";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "邮箱格式不正确";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) return "请输入密码";
  if (password.length < 8) return "密码至少 8 位";
  return null;
}

// 模拟网络延迟
function delay(ms = 800) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const emailError = validateEmail(input.email);
  if (emailError) return { ok: false, error: emailError };
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  await delay();

  const user = DEMO_USERS.find((u) => u.email === input.email.trim());
  if (!user || user.password !== input.password) {
    return { ok: false, error: "邮箱或密码错误" };
  }

  setSessionCookie();
  return { ok: true };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const emailError = validateEmail(input.email);
  if (emailError) return { ok: false, error: emailError };
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };
  if (!input.inviteCode.trim()) return { ok: false, error: "请输入邀请码" };

  await delay();

  if (!VALID_INVITE_CODES.includes(input.inviteCode.trim().toUpperCase())) {
    return { ok: false, error: "邀请码无效，请检查后重试" };
  }
  if (DEMO_USERS.some((u) => u.email === input.email.trim())) {
    return { ok: false, error: "该邮箱已注册，请直接登录" };
  }

  setSessionCookie();
  return { ok: true };
}

export async function logout(): Promise<void> {
  await delay(200);
  clearSessionCookie();
}
