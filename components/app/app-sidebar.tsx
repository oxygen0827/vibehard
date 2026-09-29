"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CatalogNavLink } from "@/components/app/catalog-nav-link";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Cpu,
  Layers,
  BookOpen,
  CircuitBoard,
  Package,
  Bug,
  MonitorSmartphone,
  Terminal,
  Wrench,
  Zap,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "总览",
    items: [{ href: "/app", label: "工作台", icon: LayoutDashboard }, { href: "/app/agent", label: "Agent 项目", icon: Bot }],
  },
  {
    title: "硬件研发",
    items: [
      { href: "/app/eda", label: "电路工作台", icon: CircuitBoard },
      { href: "/app/design", label: "方案生成", icon: Layers },
      { href: "/app/datasheets", label: "芯片资料", icon: BookOpen },
      { href: "/app/schematic", label: "原理图识别", icon: Cpu },
      { href: "/app/pcb", label: "PCB 生成", icon: CircuitBoard },
      { href: "/app/bom", label: "物料与 BOM", icon: Package },
    ],
  },
  {
    title: "嵌入式",
    items: [
      { href: "/app/debug", label: "AI 调试", icon: Bug },
      { href: "/app/embedded", label: "嵌入式开发", icon: MonitorSmartphone },
      { href: "/app/taishan", label: "设备开发", icon: Terminal },
    ],
  },
  {
    title: "效率工具",
    items: [
      { href: "/app/prompts", label: "提示词模板", icon: FileText },
      { href: "/app/tools", label: "实用工具箱", icon: Wrench },
    ],
  },
  {
    title: "扩展生态",
    items: [{ href: "/app/mcp", label: "MCP Server", icon: Zap }],
  },
  {
    title: "平台管理",
    items: [
      { href: "/app/admin", label: "管理概览", icon: ShieldCheck },
      { href: "/app/knowledge-review", label: "知识库审核", icon: BookOpen },
    ],
  },
];

export function AppNavigationSections({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <>
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.13em] text-muted-foreground">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.title === "平台管理" && <CatalogNavLink mobile={mobile} onNavigate={onNavigate} />}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/app"
                    ? pathname === "/app"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                      isActive
                        ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary transition-all duration-200",
                        isActive ? "opacity-100 scale-y-100" : "opacity-0 scale-y-50"
                      )}
                    />
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-card/60 px-3 py-5 backdrop-blur-xl md:flex">
      <nav aria-label="平台功能" className="flex-1 space-y-6 overflow-y-auto pr-1">
        <AppNavigationSections />
      </nav>
      <div className="mt-4 border-t border-border/70 pt-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          返回官网
        </Link>
      </div>
    </aside>
  );
}
