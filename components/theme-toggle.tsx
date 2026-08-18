"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="切换主题" className="h-9 w-9">
        <span className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = theme === "dark";

  const toggle = () => {
    // 切换期间给 html 加过渡类，让背景/边框/文字颜色平滑过渡
    const root = document.documentElement;
    root.classList.add("theme-animating");
    setTheme(isDark ? "light" : "dark");
    window.setTimeout(() => root.classList.remove("theme-animating"), 400);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "切换到亮色主题" : "切换到深色主题"}
      title={isDark ? "切换到亮色主题" : "切换到深色主题"}
      className="h-9 w-9 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={toggle}
    >
      <span
        key={theme}
        className="inline-flex animate-fade-up [animation-duration:0.35s]"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </Button>
  );
}
