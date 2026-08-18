"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Cpu,
  Layers,
  BookOpen,
  Zap,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/app", label: "工作台", icon: LayoutDashboard },
  { href: "/app/prompts", label: "提示词模板", icon: FileText },
  { href: "/app/schematic", label: "原理图识别", icon: Cpu },
  { href: "/app/design", label: "方案生成", icon: Layers },
  { href: "/app/datasheets", label: "芯片资料", icon: BookOpen },
  { href: "/app/mcp", label: "MCP Server", icon: Zap },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border/70 bg-card/30 p-4 backdrop-blur-xl">
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                  isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50"
                )}
              />
              <Icon
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  !isActive && "group-hover:scale-110"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 border-t border-border/70 pt-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          设置
        </Link>
      </div>
    </aside>
  );
}
