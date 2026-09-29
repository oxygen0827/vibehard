"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Loader2, Menu, X } from "lucide-react";
import { logout } from "@/lib/auth";
import { assetPath } from "@/lib/utils";
import { AppNavigationSections } from "@/components/app/app-sidebar";

export function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen = menuOpenedAt === pathname;

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpenedAt(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [menuOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="relative z-40 shrink-0 border-b border-border/70 bg-background/95 backdrop-blur-xl">
    <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:px-8">
      <Link href="/app" className="flex min-w-0 items-center gap-2.5" aria-label="VibeHard 工作台首页">
        <Image
          src={assetPath("/vibehard-icon.svg")}
          alt=""
          width={32}
          height={32}
          aria-hidden="true"
          className="block shrink-0 select-none h-8 w-8 rounded-lg"
          draggable="false"
          unoptimized
        />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          VibeHard
        </span>
        <span className="hidden rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary sm:inline-block">
          工作台
        </span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <button type="button" aria-label={menuOpen ? "关闭功能菜单" : "打开功能菜单"} aria-expanded={menuOpen} aria-controls="mobile-app-navigation" onClick={() => setMenuOpenedAt(menuOpen ? null : pathname)} className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden">
          {menuOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
        <ThemeToggle />
        <button
          type="button"
          aria-label="退出登录"
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground disabled:opacity-50 sm:px-3"
        >
          {loggingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          <span className="hidden min-[390px]:inline">退出</span>
        </button>
      </div>
    </div>
    <nav id="mobile-app-navigation" aria-label="平台功能" hidden={!menuOpen} className="max-h-[calc(100dvh-4rem)] space-y-5 overflow-y-auto border-t border-border/70 bg-background px-4 py-5 md:hidden">
      <AppNavigationSections mobile onNavigate={() => setMenuOpenedAt(null)} />
    </nav>
    </header>
  );
}
