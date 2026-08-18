"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { AUTH_CHANGED_EVENT, AUTH_COOKIE } from "@/lib/auth";
import { assetPath } from "@/lib/utils";

function subscribe(onStoreChange: () => void) {
  window.addEventListener(AUTH_CHANGED_EVENT, onStoreChange);
  window.addEventListener("focus", onStoreChange);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

function useIsLoggedIn() {
  return useSyncExternalStore(
    subscribe,
    () => document.cookie.includes(`${AUTH_COOKIE}=`),
    () => false
  );
}

export function HomeNav() {
  const isLoggedIn = useIsLoggedIn();

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-background/80 px-5 py-4 backdrop-blur-xl lg:px-12">
      <div className="flex items-center gap-2.5">
        <Image
          src={assetPath("/vibehard-icon.svg")}
          alt=""
          width={32}
          height={32}
          aria-hidden="true"
          className="block shrink-0 select-none auth-glow h-8 w-8 rounded-lg"
          draggable="false"
          unoptimized
        />
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          VibeHard
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {isLoggedIn ? (
          <Link
            href="/app"
            className="rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-[0.97] sm:px-4"
          >
            进入工作台
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors duration-200 hover:text-foreground sm:px-4"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200 hover:bg-primary/90 active:scale-[0.97] sm:px-4"
            >
              注册
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
