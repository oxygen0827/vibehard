"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Search, Download, Star } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface McpServer {
  id: string;
  name: string;
  author: string;
  description: string;
  category: string;
  downloads: string;
  stars: number;
  tags: string[];
  verified: boolean;
}

export const mcpServers: McpServer[] = [
  {
    id: "lcsc-components",
    name: "LCSC Components",
    author: "vibehard",
    description: "立创商城元器件查询：按分类/参数搜索电阻、电容、IC，获取实时价格、库存和封装信息。",
    category: "元器件",
    downloads: "3.2k",
    stars: 486,
    tags: ["立创", "BOM", "选型"],
    verified: true,
  },
  {
    id: "eda-schematic",
    name: "EDA Schematic Tools",
    author: "vibehard",
    description: "立创 EDA 原理图操作：创建/读取/修改原理图，自动布线，导出网表和 BOM。",
    category: "EDA",
    downloads: "2.8k",
    stars: 412,
    tags: ["立创EDA", "原理图", "PCB"],
    verified: true,
  },
  {
    id: "openocd-debug",
    name: "OpenOCD Debug",
    author: "vibehard",
    description: "通过 OpenOCD 连接调试器：读写 Flash/寄存器、JTAG/SWD 调试、实时采集传感器数据。",
    category: "调试",
    downloads: "1.9k",
    stars: 358,
    tags: ["OpenOCD", "SWD", "调试"],
    verified: true,
  },
  {
    id: "datasheet-parser",
    name: "Datasheet Parser",
    author: "community",
    description: "解析芯片 Datasheet PDF：提取引脚表、电气特性、时序图和典型应用电路。",
    category: "资料",
    downloads: "1.5k",
    stars: 264,
    tags: ["PDF", "Datasheet", "提取"],
    verified: false,
  },
  {
    id: "serial-monitor",
    name: "Serial Monitor",
    author: "community",
    description: "串口监控与交互：多串口监听、日志解析、AT 指令交互和自动化测试脚本。",
    category: "调试",
    downloads: "1.2k",
    stars: 197,
    tags: ["串口", "日志", "AT指令"],
    verified: false,
  },
  {
    id: "pcb-review",
    name: "PCB Review",
    author: "vibehard",
    description: "PCB 设计审查：DRC 检查、阻抗计算、EMC 风险分析和可制造性评估。",
    category: "EDA",
    downloads: "986",
    stars: 156,
    tags: ["PCB", "DRC", "EMC"],
    verified: true,
  },
  {
    id: "firmware-builder",
    name: "Firmware Builder",
    author: "community",
    description: "嵌入式固件构建：支持 ESP-IDF、STM32 HAL、Arduino 工程的云端编译和 OTA 打包。",
    category: "固件",
    downloads: "754",
    stars: 132,
    tags: ["编译", "ESP-IDF", "OTA"],
    verified: false,
  },
  {
    id: "power-analyzer",
    name: "Power Analyzer",
    author: "community",
    description: "功耗分析：读取功耗仪数据，生成电流曲线，识别异常功耗尖峰并给出优化建议。",
    category: "调试",
    downloads: "432",
    stars: 89,
    tags: ["功耗", "低功耗", "分析"],
    verified: false,
  },
];

const categories = ["全部", "元器件", "EDA", "调试", "资料", "固件"];

export default function McpPage() {
  const [category, setCategory] = useState("全部");
  const [search, setSearch] = useState("");

  const filtered = mcpServers.filter((s) => {
    const matchCategory = category === "全部" || s.category === category;
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={Zap}
        title="MCP Server"
        description="发现、安装和管理硬件研发相关的 MCP Server，扩展 AI 的能力边界"
      />

      {/* 搜索 + 分类 */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索 Server、标签..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/70 bg-card/80 text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Server 卡片 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s, i) => (
          <Link
            key={s.id}
            href={`/app/mcp/${s.id}`}
            className="animate-fade-up group flex flex-col rounded-xl border border-border/80 bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_48px_rgba(15,23,42,0.1)]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Zap className="h-5 w-5" />
              </div>
              {s.verified && (
                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                  官方认证
                </span>
              )}
            </div>

            <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-primary">
              {s.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">by {s.author}</p>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
              {s.description}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {s.downloads}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {s.stars}
              </span>
              <span className="ml-auto rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {s.category}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          没有找到匹配的 MCP Server
        </div>
      )}
    </div>
  );
}
