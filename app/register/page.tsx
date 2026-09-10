"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { register } from "@/lib/auth";
import { assetPath } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await register({ email, password, inviteCode });
    setLoading(false);
    if (result.ok) {
      router.push("/app");
      router.refresh();
    } else {
      setError(result.error ?? "注册失败，请稍后重试");
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-14rem] h-[42rem] w-[68rem] -translate-x-1/2 rounded-full bg-primary/[0.09] blur-[150px]" />
        <div className="auth-grid absolute inset-0 opacity-[0.16] dark:opacity-25" />
      </div>

      <div className="animate-fade-up relative z-10 w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_18px_48px_rgba(15,23,42,0.09)] dark:shadow-[0_22px_58px_rgba(0,0,0,0.24)]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Image
            src={assetPath("/vibehard-icon.svg")}
            alt=""
            width={32}
            height={32}
            aria-hidden="true"
            className="h-8 w-8 rounded-lg"
            unoptimized
          />
          <span className="text-lg font-semibold">VibeHard AI</span>
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold">邀请码注册</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            直接登录
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              邮箱
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              密码
            </label>
            <Input
              id="password"
              type="password"
              placeholder="至少 8 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inviteCode" className="text-sm font-medium text-foreground">
              邀请码
            </label>
            <Input
              id="inviteCode"
              type="text"
              placeholder="请输入邀请码"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "注册中..." : "注册并进入工作台"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
